/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    await knex.schema.createTable("wb_tariffs", (table) => {
        table.increments("id").primary();
        table.date("day").notNullable();
        table.integer("hour").notNullable();
        table.integer("tariff_id").notNullable();
        table.string("name").notNullable();
        table.decimal("coefficient", 10, 4).notNullable();
        table.decimal("min_cost", 10, 2).notNullable();
        table.decimal("max_cost", 10, 2).nullable();
        table.timestamp("created_at").defaultTo(knex.fn.now());
        table.timestamp("updated_at").defaultTo(knex.fn.now());

        // Уникальный индекс для UPSERT (день + час + tariff_id)
        table.unique(["day", "hour", "tariff_id"], "uq_wb_tariffs_day_hour_tariff");

        // Индекс для быстрого поиска по дню
        table.index("day", "idx_wb_tariffs_day");
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    await knex.schema.dropTable("wb_tariffs");
}
