# WB Tariffs Collector

Сервис для сбора тарифов Wildberries и выгрузки в Google Таблицы.

## Функционал

- Ежечасное получение тарифов из WB API (`/api/v1/tariffs/box`)
- Сохранение данных в PostgreSQL с UPSERT (обновление за день)
- Выгрузка в Google Таблицы с сортировкой по коэффициенту
- Автоматическая синхронизация по расписанию (cron)

---

## Быстрый старт

### Вариант 1: Docker с PostgreSQL (рекомендуется)

```bash
# 1. Войти в Docker Hub (чтобы избежать лимитов)
docker login

# 2. Скопировать .env
cp example.env .env

# 3. Настроить переменные (WB_API_TOKEN, GOOGLE_APPS_SCRIPT_URL)

# 4. Запустить
docker compose up --build
```

### 3. Запуск одной командой

```bash
docker compose up --build
```

Приложение автоматически:
1. Применит миграции к БД
2. Выполнит первичную синхронизацию тарифов
3. Запустит cron-планировщик для ежечасного обновления

---

## Настройка Google Sheets

### Шаг 1: Создать Google Таблицу

1. Откройте [Google Таблицы](https://sheets.google.com/)
2. Создайте новую таблицу
3. Назовите её (например, "WB Tariffs")

### Шаг 2: Открыть редактор Apps Script

1. В таблице: **Расширения** → **Apps Script**
2. Откроется редактор скриптов

### Шаг 3: Вставить код скрипта

Удалите весь существующий код и вставьте этот:

```javascript
/**
 * Обработка POST запросов с данными тарифов
 */
function doPost(e) {
  try {
    // Парсим полученные данные
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.sheetName || 'stocks_coefs';
    const headers = data.headers || ['ID', 'Название', 'Коэффициент', 'Мин. стоимость', 'Макс. стоимость'];
    const tariffs = data.tariffs || [];

    // Получаем активную таблицу
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // Находим или создаём лист
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    // Очищаем лист (полностью)
    sheet.clearContents();
    sheet.clearFormats();

    // Записываем заголовок
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Форматируем заголовок (жирный шрифт)
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, 1, headers.length).setBackground('#f3f3f3');

    // Записываем данные тарифов
    if (tariffs.length > 0) {
      const rows = tariffs.map(t => [
        t.tariff_id,
        t.name,
        t.coefficient,
        t.min_cost,
        t.max_cost || ''
      ]);
      
      // Записываем все строки сразу
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
      
      // Авто-подбор ширины колонок
      sheet.autoResizeColumns(1, rows[0].length);
    }

    // Замораживаем первую строку (заголовок)
    sheet.setFrozenRows(1);

    return ContentService
      .createTextOutput('OK: ' + tariffs.length + ' tariffs written')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    return ContentService
      .createTextOutput('ERROR: ' + error.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Тестовая функция (для проверки)
 */
function test() {
  Logger.log('Apps Script is working!');
}
```

### Шаг 4: Разместить как веб-приложение

1. В редакторе Apps Script нажмите **Разместить** → **Новое развёртывание**
2. Выберите тип: **Веб-приложение**
3. Настройте:
   - **Описание**: `WB Tariffs Webhook`
   - **Кто имеет доступ**: **Все** (важно!)
4. Нажмите **Разместить**
5. Разрешите доступ при запросе

### Шаг 5: Скопировать URL

После развёртывания вы получите URL вида:
```
https://script.google.com/macros/s/AKfycbxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec
```

Скопируйте этот URL в `.env`:
```env
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
```

---

## Проверка работы

### Логи приложения

```bash
docker compose logs -f app
```

Ожидаемые логи при успешной синхронизации:
```
[APP] Starting application...
[APP] Database migrations and seeds completed
[SCHEDULER] Starting cron with schedule: 0 * * * *
[SCHEDULER] Starting full sync...
[WB-SERVICE] Fetching tariffs from ...
[WB-SERVICE] Successfully fetched 5 tariffs
[WB-SERVICE] Saving 5 tariffs for 2026-03-11 14:00
[WB-SERVICE] Successfully saved/updated tariffs in database
[SCHEDULER] Got 5 latest tariffs from DB (sorted by coefficient)
[GOOGLE-APPS] Sending 5 tariffs to https://script.google.com/...
[GOOGLE-APPS] Response: OK: 5 tariffs written
[GOOGLE-APPS] Successfully sent 5 tariffs to Google Sheet
[SCHEDULER] Google Sheets sync completed
[SCHEDULER] Full sync completed for 2026-03-11 14:00
```

### Данные в базе данных

```bash
docker exec -it postgres psql -U postgres -d postgres \
  -c "SELECT * FROM wb_tariffs ORDER BY day DESC, hour DESC LIMIT 10;"
```

### Проверка Google Таблицы

1. Откройте вашу таблицу
2. Найдите лист `stocks_coefs`
3. Проверьте:
   - Заголовок: **ID | Название | Коэффициент | Мин. стоимость | Макс. стоимость**
   - Данные **отсортированы по возрастанию коэффициента**
   - Заголовок заморожен (первая строка зафиксирована)

---

## Структура таблицы тарифов (PostgreSQL)

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial | ID записи |
| day | date | Дата |
| hour | int | Час (0-23) |
| tariff_id | int | ID тарифа из API |
| name | string | Название тарифа |
| coefficient | decimal | Коэффициент |
| min_cost | decimal | Мин. стоимость |
| max_cost | decimal | Макс. стоимость (nullable) |
| created_at | timestamp | Дата создания |
| updated_at | timestamp | Дата обновления |

Уникальный индекс: `(day, hour, tariff_id)` — обеспечивает UPSERT.

---

## Структура проекта

```
src/
├── app.ts                          # Точка входа + graceful shutdown
├── scheduler.ts                    # Cron планировщик
├── config/
│   ├── env/env.ts                  # Валидация переменных (Zod)
│   └── knex/knexfile.ts            # Конфигурация Knex
├── postgres/
│   ├── migrations/                 # Миграции БД
│   ├── seeds/                      # Сиды
│   └── knex.ts                     # Knex экземпляр + утилиты
├── services/
│   ├── wbApi.ts                    # WB API клиент
│   ├── tariffService.ts            # Сервис тарифов (БД)
│   └── googleAppsScript.ts         # Google Apps Script webhook
├── scripts/
│   └── sync-tariffs.ts             # Скрипт ручной синхронизации
└── types/
    └── tariff.ts                   # Типы данных
```

---

## Расписание задач

### Изменение расписания

В `.env` измените `CRON_SCHEDULE`:

```env
# Каждый час (по умолчанию)
CRON_SCHEDULE=0 * * * *

# Каждые 30 минут
CRON_SCHEDULE=*/30 * * * *

# Каждый день в 9:00
CRON_SCHEDULE=0 9 * * *

# Каждый понедельник в 8:00
CRON_SCHEDULE=0 8 * * 1
```

Формат: `минута час день_месяца месяц день_недели`

---

## Команды для разработки

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev

# Применение миграций
npm run knex:dev migrate latest

# Ручная синхронизация (тест)
WB_API_TOKEN=your_token npm run sync:tariffs

# Сборка проекта
npm run build

# Проверка TypeScript
npm run tsc:check
```

---

## Docker команды

```bash
# Запуск всех сервисов
docker compose up --build

# Запуск в фоне
docker compose up -d

# Остановка и удаление данных
docker compose down --volumes --rmi local

# Просмотр логов
docker compose logs -f app
docker compose logs -f postgres

# Перезапуск приложения
docker compose restart app
```

---

## Требования

- Docker & Docker Compose
- Node.js 20+ (для локальной разработки)
- PostgreSQL 16+ (в Docker)
- Google аккаунт (для Apps Script)

---

## Troubleshooting

### Ошибка: "Google Apps Script URL not configured"

Проверьте, что `GOOGLE_APPS_SCRIPT_URL` указан в `.env`.

### Ошибка: "HTTP 401 Unauthorized" от Apps Script

Проверьте настройки развёртывания:
- **Кто имеет доступ** должно быть **Все**
- URL должен оканчиваться на `/exec` (не `/dev`)

### Ошибка: "401 Unauthorized" от WB API

Проверьте токен в личном кабинете поставщика WB.

### Таблица не обновляется

1. Проверьте логи: `docker compose logs app | grep GOOGLE-APPS`
2. Убедитесь, что URL правильный (скопирован из развёртывания)
3. Проверьте, что скрипт размещён (статус "В сети")

### Скрипт выдаёт ошибку

1. Откройте редактор Apps Script
2. Запустите функцию `test()` для проверки
3. Проверьте журнал выполнения (View → Executions)
