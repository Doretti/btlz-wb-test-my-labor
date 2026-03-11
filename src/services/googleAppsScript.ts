import { TariffRecord } from "#types/tariff.js";

const SHEET_NAME = "stocks_coefs";
const HEADERS = ["ID", "Название", "Коэффициент", "Мин. стоимость", "Макс. стоимость"];

/**
 * Отправка тарифов в Google Таблицу через Apps Script Webhook
 * @param webhookUrl - URL Google Apps Script webhook
 * @param tariffs - Массив тарифов (уже отсортированных по коэффициенту)
 */
export async function sendTariffsToGoogleSheet(
    webhookUrl: string,
    tariffs: TariffRecord[]
): Promise<void> {
    console.log(`[GOOGLE-APPS] Sending ${tariffs.length} tariffs to ${webhookUrl}`);

    try {
        // Данные уже отсортированы по коэффициенту (из БД)
        const payload = {
            sheetName: SHEET_NAME,
            headers: HEADERS,
            tariffs: tariffs.map((t) => ({
                tariff_id: t.tariff_id,
                name: t.name,
                coefficient: t.coefficient,
                min_cost: t.min_cost,
                max_cost: t.max_cost,
            })),
        };

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.text();
        console.log(`[GOOGLE-APPS] Response: ${result}`);
        console.log(`[GOOGLE-APPS] Successfully sent ${tariffs.length} tariffs to Google Sheet`);
    } catch (error) {
        console.error(`[GOOGLE-APPS] Error sending data:`, error);
        throw error;
    }
}

/**
 * Синхронизация всех таблиц через webhook
 * @param webhookUrl - URL Google Apps Script webhook
 * @param tariffs - Массив тарифов
 */
export async function syncAllSheets(
    webhookUrl: string,
    tariffs: TariffRecord[]
): Promise<void> {
    console.log(`[GOOGLE-APPS] Starting sync with webhook`);

    try {
        await sendTariffsToGoogleSheet(webhookUrl, tariffs);
        console.log(`[GOOGLE-APPS] Sync completed successfully`);
    } catch (error) {
        console.error(`[GOOGLE-APPS] Sync failed:`, error);
        throw error;
    }
}
