import knex from "#postgres/knex.js";
import { TariffDto, TariffRecord, WbTariffItem } from "#types/tariff.js";

/**
 * Конвертация WbTariffItem в TariffDto
 */
function toDto(item: WbTariffItem): TariffDto {
    return {
        tariff_id: item.id,
        name: item.name,
        coefficient: item.coefficient,
        min_cost: item.minCost,
        max_cost: item.maxCost,
    };
}

/**
 * Сохранение тарифов в БД с UPSERT логикой
 * @param day - Дата в формате YYYY-MM-DD
 * @param hour - Час (0-23)
 * @param tariffs - Массив тарифов
 */
export async function saveTariffs(
    day: string,
    hour: number,
    tariffs: WbTariffItem[]
): Promise<void> {
    console.log(`[WB-SERVICE] Saving ${tariffs.length} tariffs for ${day} ${hour}:00`);

    const records = tariffs.map((item) => ({
        ...toDto(item),
        day,
        hour,
    }));

    // UPSERT: вставка с обновлением при конфликте
    await knex("wb_tariffs")
        .insert(records)
        .onConflict(["day", "hour", "tariff_id"])
        .merge({
            coefficient: knex.ref("excluded.coefficient"),
            min_cost: knex.ref("excluded.min_cost"),
            max_cost: knex.ref("excluded.max_cost"),
            updated_at: knex.fn.now(),
        });

    console.log(`[WB-SERVICE] Successfully saved/updated tariffs in database`);
}

/**
 * Получение актуальных тарифов за день (последняя запись)
 * @param day - Дата в формате YYYY-MM-DD
 * @returns Массив записей тарифов
 */
export async function getLatestTariffs(day: string): Promise<TariffRecord[]> {
    console.log(`[WB-SERVICE] Fetching latest tariffs for ${day}`);

    // Подзапрос для получения максимального часа за день
    const latestHour = knex("wb_tariffs")
        .max("hour as max_hour")
        .where({ day })
        .first();

    const records = await knex("wb_tariffs")
        .select("*")
        .where({ day })
        .whereIn("hour", latestHour)
        .orderBy("coefficient", "asc");

    console.log(`[WB-SERVICE] Found ${records.length} tariff records for ${day}`);
    return records as TariffRecord[];
}

/**
 * Получение тарифов за конкретный час
 */
export async function getTariffsByHour(
    day: string,
    hour: number
): Promise<TariffRecord[]> {
    const records = await knex("wb_tariffs")
        .select("*")
        .where({ day, hour })
        .orderBy("coefficient", "asc");

    return records as TariffRecord[];
}
