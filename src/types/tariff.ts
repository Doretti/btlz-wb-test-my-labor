/**
 * Ответ от WB API для одного тарифа
 */
export interface WbTariffItem {
    id: number;
    name: string;
    coefficient: number;
    minCost: number;
    maxCost: number | null;
}

/**
 * Полный ответ от WB API
 */
export interface WbTariffResponse {
    tariffs: WbTariffItem[];
}

/**
 * Запись в базе данных
 */
export interface TariffRecord {
    id?: number;
    day: string;        // YYYY-MM-DD
    hour: number;       // 0-23
    tariff_id: number;
    name: string;
    coefficient: number;
    min_cost: number;
    max_cost: number | null;
    created_at?: string;
    updated_at?: string;
}

/**
 * DTO для передачи данных между сервисами
 */
export interface TariffDto {
    tariff_id: number;
    name: string;
    coefficient: number;
    min_cost: number;
    max_cost: number | null;
}
