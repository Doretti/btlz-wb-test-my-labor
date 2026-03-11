import { WbTariffResponse, WbTariffItem } from "#types/tariff.js";

const WB_API_URL = "https://common-api.wildberries.ru/api/v1/tariffs/box";
const REQUEST_TIMEOUT = 10000; // 10 секунд
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 секунда

/**
 * Задержка перед следующей попыткой
 */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Запрос к WB API с retry-логикой
 */
async function fetchWithRetry(
    url: string,
    token: string,
    retries = MAX_RETRIES
): Promise<Response> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        console.log(`[WB-SERVICE] Making request to ${url}`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`[WB-SERVICE] Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "No body");
            console.error(`[WB-SERVICE] Error response body: ${errorBody}`);
            throw new Error(`WB API error: ${response.status} ${response.statusText}`);
        }

        return response;
    } catch (error) {
        if (retries > 0) {
            console.log(
                `[WB-SERVICE] Request failed, retrying... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`
            );
            await delay(RETRY_DELAY);
            return fetchWithRetry(url, token, retries - 1);
        }
        throw error;
    }
}

/**
 * Валидация ответа от API
 */
function validateTariffItem(item: unknown): WbTariffItem {
    const data = item as Record<string, unknown>;

    if (
        typeof data.id !== "number" ||
        typeof data.name !== "string" ||
        typeof data.coefficient !== "number" ||
        typeof data.minCost !== "number"
    ) {
        throw new Error(`Invalid tariff item structure: ${JSON.stringify(item)}`);
    }

    return {
        id: data.id,
        name: data.name,
        coefficient: data.coefficient,
        minCost: data.minCost,
        maxCost: typeof data.maxCost === "number" ? data.maxCost : null,
    };
}

/**
 * Форматирование даты в YYYY-MM-DD
 */
function formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
}

/**
 * Получение тарифов из WB API
 * @param token - API токен Wildberries
 * @returns Массив тарифов
 */
export async function getBoxTariffs(token: string): Promise<WbTariffItem[]> {
    const date = formatDate(new Date());
    const url = `${WB_API_URL}?date=${date}`;
    
    console.log(`[WB-SERVICE] Fetching tariffs from ${url}`);

    const response = await fetchWithRetry(url, token);
    const data = (await response.json()) as unknown;

    console.log(`[WB-SERVICE] Raw API response:`, JSON.stringify(data).substring(0, 200) + "...");

    // Парсим структуру ответа WB API:
    // {"response": {"data": {"warehouseList": [...]}}}
    const responseData = data as Record<string, unknown>;
    
    if (!responseData.response) {
        throw new Error(`Invalid WB API response structure: ${JSON.stringify(data)}`);
    }
    
    const responseInner = responseData.response as Record<string, unknown>;
    
    if (!responseInner.data) {
        throw new Error(`Invalid WB API response data structure: ${JSON.stringify(data)}`);
    }
    
    const dataInner = responseInner.data as Record<string, unknown>;
    
    if (!dataInner.warehouseList || !Array.isArray(dataInner.warehouseList)) {
        throw new Error(`Invalid WB API warehouseList structure: ${JSON.stringify(data)}`);
    }
    
    const warehouseList = dataInner.warehouseList as unknown[];
    console.log(`[WB-SERVICE] Found ${warehouseList.length} warehouses in response`);

    // Преобразуем данные о складах в тарифы
    const tariffs: WbTariffItem[] = warehouseList.map((warehouse: unknown, index: number) => {
        const w = warehouse as Record<string, unknown>;
        
        // Извлекаем данные для boxDelivery (доставка коробом)
        const boxDeliveryBase = parseFloat(String(w.boxDeliveryBase || "0").replace(",", ".")) || 0;
        const boxDeliveryCoefExpr = String(w.boxDeliveryCoefExpr || "0").replace(",", ".");
        const boxDeliveryCoef = parseFloat(boxDeliveryCoefExpr) || 0;
        const boxDeliveryLiter = parseFloat(String(w.boxDeliveryLiter || "0").replace(",", ".")) || 0;
        
        return {
            id: index + 1,
            name: String(w.warehouseName || "Unknown"),
            coefficient: boxDeliveryCoef,
            minCost: boxDeliveryBase,
            maxCost: boxDeliveryLiter > 0 ? boxDeliveryLiter : null,
        };
    }).filter(t => t.coefficient > 0); // Фильтруем тарифы с нулевым коэффициентом

    console.log(`[WB-SERVICE] Successfully parsed ${tariffs.length} tariffs`);
    return tariffs;
}
