import cron from "node-cron";
import { getBoxTariffs } from "#services/wbApi.js";
import { saveTariffs, getLatestTariffs } from "#services/tariffService.js";
import { syncAllSheets } from "#services/googleAppsScript.js";
import env from "#config/env/env.js";

/**
 * Форматирование даты в YYYY-MM-DD
 */
function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

/**
 * Текущий час
 */
function getCurrentHour(): number {
    return new Date().getHours();
}

/**
 * Полная синхронизация: WB API → БД → Google Sheets
 */
async function runFullSync(): Promise<void> {
    const day = formatDate(new Date());
    const hour = getCurrentHour();

    console.log("[SCHEDULER] Starting full sync...");

    try {
        // 1. Получаем данные из WB API
        const token = env.WB_API_TOKEN;
        if (!token) {
            console.log("[SCHEDULER] WB_API_TOKEN not configured, skipping");
            return;
        }

        const tariffs = await getBoxTariffs(token);
        console.log(`[SCHEDULER] Fetched ${tariffs.length} tariffs from WB API`);

        // 2. Сохраняем в БД
        await saveTariffs(day, hour, tariffs);
        console.log(`[SCHEDULER] Saved tariffs to database`);

        // 3. Получаем актуальные данные (отсортированные по коэффициенту)
        const latestTariffs = await getLatestTariffs(day);
        console.log(`[SCHEDULER] Got ${latestTariffs.length} latest tariffs from DB (sorted by coefficient)`);

        // 4. Выгружаем в Google Sheets через Apps Script
        const appsScriptUrl = env.GOOGLE_APPS_SCRIPT_URL;

        if (appsScriptUrl) {
            await syncAllSheets(appsScriptUrl, latestTariffs);
            console.log("[SCHEDULER] Google Sheets sync completed");
        } else {
            console.log("[SCHEDULER] Google Apps Script URL not configured, skipping");
        }

        console.log(`[SCHEDULER] Full sync completed for ${day} ${hour}:00`);
    } catch (error) {
        console.error("[SCHEDULER] Full sync failed:", error);
        throw error;
    }
}

/**
 * Запуск планировщика
 * @returns Функция для остановки планировщика
 */
export function startScheduler(): () => void {
    const schedule = env.CRON_SCHEDULE || "0 * * * *";

    console.log(`[SCHEDULER] Starting cron with schedule: ${schedule}`);

    const task = cron.schedule(schedule, async () => {
        console.log(`[SCHEDULER] Cron triggered at ${new Date().toISOString()}`);
        await runFullSync();
    }, {
        timezone: "Europe/Moscow",
    });

    console.log("[SCHEDULER] Scheduler started successfully");

    // Выполняем первичную синхронизацию при старте
    runFullSync().catch((error) => {
        console.error("[SCHEDULER] Initial sync failed:", error);
    });

    // Возвращаем функцию остановки
    return () => {
        console.log("[SCHEDULER] Stopping scheduler...");
        task.stop();
        console.log("[SCHEDULER] Scheduler stopped");
    };
}
