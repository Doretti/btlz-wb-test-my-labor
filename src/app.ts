import knex, { migrate } from "#postgres/knex.js";
import { startScheduler } from "#scheduler.js";

/**
 * Обработчик сигналов завершения
 */
function setupGracefulShutdown(stopScheduler?: () => void): void {
    const shutdown = (signal: string) => {
        console.log(`[APP] Received ${signal}, shutting down gracefully...`);

        const tasks: Promise<void>[] = [];

        // Останавливаем планировщик
        if (stopScheduler) {
            tasks.push(Promise.resolve(stopScheduler()));
        }

        // Закрываем соединения с БД
        tasks.push(
            knex.destroy().then(() => {
                console.log("[APP] Database connections closed");
            })
        );

        Promise.all(tasks)
            .then(() => {
                console.log("[APP] Shutdown completed");
                process.exit(0);
            })
            .catch((err) => {
                console.error("[APP] Error during shutdown:", err);
                process.exit(1);
            });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
}

/**
 * Точка входа
 */
async function main(): Promise<void> {
    console.log("[APP] Starting application...");

    try {
        // Применяем миграции
        await migrate.latest();
        console.log("[APP] Database migrations completed");
    } catch (error) {
        console.error("[APP] Failed to apply migrations:", error);
        process.exit(1);
    }

    // Запускаем планировщик (cron + первичная синхронизация)
    let stopScheduler: (() => void) | undefined;
    try {
        stopScheduler = startScheduler();
    } catch (error) {
        console.error("[APP] Failed to start scheduler:", error);
        // Не прерываем работу, планировщик не критичен
    }

    console.log("[APP] Application initialized successfully");
    console.log("[APP] Scheduler is running, waiting for cron triggers...");

    // Настройка graceful shutdown
    setupGracefulShutdown(stopScheduler);
}

main();
