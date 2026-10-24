---
name: second-deposit-igaming
category: analytics
description: Finds why casino first-time depositors (FTD) do not make a second deposit, from the operator's back-office exports (deposits, and if available withdrawals, bonuses, bets, players). Assigns each FTD one of 12 reasons, estimates missed second deposits and Sum Dep per reason, computes 24 metrics and builds a list of recent FTDs for CRM with an action by player state and country rules. Use when the user mentions second deposit, STD, FTD to STD, asks why FTDs do not come back or gives casino deposit exports. For industry professionals, 21+.
license: MIT
---

# second-deposit-igaming

For industry professionals (casino CRM, retention, product and analytics teams). 21+. Not gambling advertising.

A Claude Code skill that reads casino back-office exports and shows on which first-session scenario players are lost, what it costs in Sum Dep per month and which recent FTDs can still be won back. Calculations run in local Python scripts (python3 3.9 or newer, standard library only). Claude sees column names, formats and totals, not player rows.

Source repository: https://github.com/igamingsychov/second-deposit-igaming (MIT, author Yevhen Sychov). The detailed instructions at the end are the original skill text in Russian, kept unchanged. Support files used by the instructions: `scripts/`, `references/`, `examples/`.

## When to Use This Skill

- The user asks why FTDs do not come back, asks about the second deposit, STD or FTD to STD, or asks to analyze casino deposits.
- The user provides deposit exports (CSV or XLSX) or wants a daily list of recent FTDs without a second deposit for CRM.
- Original trigger phrases: "второй депозит", "STD", "почему FTD не возвращаются", "разбери депозиты", "second deposit", "FTD to STD", "/second-deposit".

## What This Skill Does

1. **12 reasons**: each FTD gets one reason (for example many failed attempts in a row, second deposit failed, withdrawal declined, documents requested, heavy wagering bonus, burned out fast, money left on balance). Everyone else forms the norm.
2. **Missed value**: how many second deposits are missing against the norm of similar players for each reason, and the Sum Dep range they would bring in 30 days.
3. **24 metrics with definitions**: second deposit within 24 hours, 72 hours, 7 and 30 days, time to it, Sum Dep per FTD, cashier approval, withdrawals and their declines, bonuses, first session, weekly trend.
4. **Today's list**: FTDs of the last 72 hours without a second deposit, with reason, state, when to write, what to offer and a payment method that works in the player's country. One CSV per action for CRM import.
5. **Country rules**: legal payout deadlines, payment methods banned in the country and legal deposit limits change the actions. Official sources only, listed in `references/geo_rules.md`.

## How to Use

### Basic Usage

```
show the second-deposit skill demo
```

### Advanced Usage

```
why don't our FTDs come back? exports are in ~/Downloads/exports
```

## Example

**User**: "show the second-deposit skill demo"

**Output**:
```
Claude creates a fictional workbook in the sample format and builds a report from it.
Output folder second-deposit/ next to the exports:
report.html, rescue_list.csv, summary.json, scenarios.csv, segments.csv, excluded_rg.csv, lists/<date>/
```

## Tips

- First run and once a month: a 60-120 day export. Every day: the last 7 days with the first deposit date for players.
- No market benchmarks: without history the norm, forecast and money appear from day 8, once 50 FTDs are older than 7 days.
- Google Sheets: download the workbook as XLSX, the skill does not open links.
- The optional daily schedule is added to the system scheduler only after explicit user consent.

## Original instructions

The text below is the original skill (Russian), unchanged.

# Второй депозит

Скилл отвечает на вопрос "почему FTD не возвращаются и сколько это стоит". Считает код, модель только сопоставляет колонки и пересказывает итоги. Данные игроков не покидают компьютер: скрипты печатают агрегаты, списки игроков пишут в файлы.

Папка скилла: та, где лежит этот файл (обычно `~/.claude/skills/second-deposit`). Нужен только `python3` (3.9 и новее), сторонние библиотеки не нужны.

## Правила приватности (строго)

1. Не открывай выгрузки и не читай их строки: ни Read, ни cat, ни head. Все, что нужно для сопоставления, печатает `sd_inspect.py`, он скрывает ID, суммы и свободный текст.
2. Не открывай `rescue_list.csv`, `excluded_rg.csv` и файлы в папке `lists`, в них ID игроков. Пересказывай пользователю итоги из `summary.json`.
3. Не отправляй данные никуда: никаких загрузок, веб-сервисов и внешних API.
4. Если пользователь сам вставил строки с данными игроков в чат, не повторяй их в ответе.

## Как скилл учится под проект

- **Есть история.** Полный запуск по выгрузке за 60-120 дней собирает профиль проекта `profile.json`: второй депозит за 24 часа, 72 часа, 7 и 30 дней, кривые возврата по каждой причине и у нормы, норма похожих игроков, додепы (сумма второго депозита, второй к первому, депозитов у вернувшегося, Sum Dep), апрув по странам и способам оплаты, время выплаты. Ежедневные запуски берут вводные из профиля и считают прогноз по списку на сегодня. Профиль обновляется каждым полным запуском.
- **Истории нет.** Публичного бенчмарка второго депозита нет: открытых цифр с методикой не нашлось ни по одной стране, поэтому скилл не подставляет чужие цифры. Причины, действия и правила стран работают с первого дня. Норма, прогноз и деньги появляются с 8-го дня: когда у первых FTD пройдет 7 дней и таких FTD наберется 50, скрипт сам перейдет на полный расчет и сохранит профиль. Если пользователь просит ориентиры или нормы рынка, скажи именно это и не называй цифр.
- **Правила стран** (`references/geo_rules.json`, описание и официальные источники в `geo_rules.md`): порог долгого вывода по законному сроку страны, если он короче 24 часов (Бразилия 2 часа, Колумбия 12); запрещенные в стране способы оплаты не подсказываются; при отказе по лимиту депозитов другой способ не предлагается, действие "объяснить лимит"; игрок с блокировкой гемблинга в банке исключается, как флаг ответственной игры. Чтобы фильтр способов работал точно, добавь в `mapping.json` поле `method_types`: каждому способу оплаты из выгрузки тип `card`, `credit_card`, `instant_bank`, `online_banking`, `ewallet`, `voucher_cash`, `mobile_money` или `crypto` (без него тип угадывается по названию). Если страны в выгрузке нет, а проект работает в одной стране, запускай с `--country BR`.

## Два режима

- **Полный** (первый запуск, потом раз в месяц): выгрузка за 60-120 дней. Причины, недобор вторых депозитов и Sum Dep (вилка от и до) против нормы похожих игроков, показатели, срезы, список. Сохраняет профиль проекта `profile.json`.
- **Список** (каждый день): выгрузка за последние 7 дней с датой первого депозита у игроков. Причины и список на сегодня; способы оплаты, история причин и прогноз из профиля. Скрипт сам выбирает режим: если FTD старше 7 дней меньше 50, это режим списка.
- Обе выгрузки кладутся в одну рабочую папку проекта, результат всегда в `<папка>/second-deposit`: там живут профиль и журнал `rescue_log.csv`. Не меняй папку результата между запусками, иначе пропадут профиль и журнал.
- С `"latest": true` у файлов в `mapping.json` и маской в `path` (`deposits*.csv`) скрипт берет самую свежую выгрузку по времени изменения: ежедневные файлы копятся в одной папке, а раз в месяц туда же кладется выгрузка за 60-120 дней, и профиль пересчитывается сам.
- В списке 20% игроков (без сервисных случаев) уходят в контрольную группу: им не пишут 7 дней. Журнал копит, кто вернулся, и отчет показывает эффект действий против контрольной группы, когда у игроков пройдет 7 дней.

## Порядок работы

1. **Найди выгрузки.** Спроси папку, если пользователь ее не назвал.
   - Человек не знает, что выгружать: дай путь к `examples/export-example.xlsx` (листы "Инструкция" и "Колонки" объясняют, что и откуда брать) и скажи коротко: в первый раз депозиты со всеми попытками за 60-120 дней, желательно выводы, бонусы, ставки по дням и список игроков; дальше каждый день то же за последние 7 дней, у игроков дата первого депозита; названия колонок могут быть свои.
   - Выгрузки делает аналитик или администратор базы: дай `examples/export-queries.sql`. В нем запрос на каждый файл с теми же названиями колонок, что в примере, и минимум одним запросом (депозиты и выводы с данными игрока в строке, 7 из 12 причин). Для таких CSV готовы `examples/mapping-csv-example.json` и `examples/mapping-one-file-example.json`.
   - Данные в Google Таблицах: не открывай ссылку и не скачивай по ней. Попроси пользователя скачать книгу: Файл, Скачать, Microsoft Excel (.xlsx), все листы попадут в один файл, и положить его в папку. Ссылка, которая открывается без входа в аккаунт, видна любому, у кого она есть, поэтому для данных игроков не подходит.
   - Выгрузок нет, но хочется посмотреть: `python3 scripts/make_demo.py <папка>/demo --xlsx` создаст вымышленную книгу `export.xlsx` в формате примера и готовый `mapping.json`, переходи к шагу 4.
2. **Посмотри структуру:** `python3 scripts/sd_inspect.py <папка или файлы>`.
3. **Собери `mapping.json`** в папке с выгрузками.
   - Книга в формате примера (листы "Депозиты", "Выводы", "Бонусы", "Ставки", "Игроки" с теми же колонками): скопируй `examples/mapping-example.json`, поменяй `path` на имя файла и сверь статусы с обзором.
   - CSV по `export-queries.sql`: скопируй `mapping-csv-example.json` (файл на лист) или `mapping-one-file-example.json` (один файл) и сверь статусы с обзором. В них уже маски и `"latest": true` для ежедневных выгрузок.
   - Свои выгрузки: собери по образцу из `references/data.md`. Сопоставь колонки с полями (`player_id`, `time`, `amount`, `status` и т.д.), разнеси каждое значение статуса и типа операции, флаги ответственной игры (самоисключение, лимиты, тайм-аут, признаки риска) перечисли в `players.rg_flags`, укажи валюту отчета, `fx`, `dayfirst`, `decimal`, `tz`, если обзор показал такой формат.
   - Статусы депозитов: `success` только успешный; `declined` отказ банка, провайдера или ошибка; `abandoned` игрок отменил, бросил или оплата истекла; `cancelled` для депозита тоже неудачная попытка; `pending` не учитывается. Статусы выводов: `declined` и `cancelled` не считаются, `pending` считается запросом на вывод.
   - Причина отказа у депозитов: если обзор показал такую колонку, сопоставь ее как `reason` и разнеси в `decline_reasons`: в `limit` только значения про лимит депозитов (лимит игрока или законный), в `block` только значения, где прямо сказано, что гемблинг заблокирован банком или самим игроком. Общие отказы банка ("Do not honor", "Insufficient funds", ошибки 3DS) не трогай: это обычный отказ, ему подсказывается другой способ оплаты.
   - Колонки с именами, email, телефонами, адресами никогда не сопоставляй. Если обзор их показал, скажи пользователю, что они не нужны и в следующий раз их лучше не выгружать.
   Спрашивай пользователя только о том, что нельзя понять из обзора: значение непонятного статуса, неоднозначный порядок дня и месяца, курсы валют, часовой пояс файлов без пояса, если в других файлах время с поясом (`Z`, `+03:00`), и реальные ли деньги в ставках, если по названию колонки это неясно. Задавай все вопросы одним сообщением.
4. **Проверь готовность:** `python3 scripts/sd_analyze.py --mapping <папка>/mapping.json --out <папка>/second-deposit --check`. Скрипт скажет, сколько причин из 12 посчитается и чего не хватает, какой будет режим (полный или список) и что проверить (страна, флаги ответственной игры, типы способов оплаты). Перескажи это пользователю одним сообщением: если не хватает данных, которые легко добавить, предложи добавить их до расчета, иначе считай.
5. **Запусти расчет:** `python3 scripts/sd_analyze.py --mapping <папка>/mapping.json --out <папка>/second-deposit --lang ru` (язык ответа пользователя: `ru`, `uk` или `en`). Если скрипт остановился с ошибкой сопоставления, исправь `mapping.json` и запусти снова. Проверь две строки вывода: "Бонусы" (у каждого бонуса найден вейджер, тяжелые помечены верно) и "Попытки депозита по статусам" (неудачных попыток не ноль). Остальные параметры (окно второго депозита, порог тяжелого вейджера и другие) меняй, только если пользователь попросил: `python3 scripts/sd_analyze.py --help`.
6. **Прочитай `summary.json`** и ответь коротко:
   - STD за окно и норма (STD игроков без проблемных сигналов);
   - недобор Sum Dep в месяц вилкой: от `lost_month_min` (только сами вторые депозиты) до `lost_month` (Sum Dep вернувшегося за 30 дней), и три причины с самым большим недобором: сколько FTD, STD против нормы, вилка, что делать;
   - срезы из `segments`, если есть;
   - главные показатели из `metrics`: второй депозит за 24 часа и 7 дней, апрув кассы, доля выводов и отклоненных выводов, Sum Dep на одного FTD, динамика по неделям из `weekly`;
   - список: сколько игроков, по каким действиям (`rescue.actions`), на какой момент снят (последняя попытка депозита в выгрузке) и путь к папке `rescue.list_dir`: в ней `actions.csv` (сводка действий), файл на каждое действие для загрузки в CRM как сегмент, `rescue_list.xlsx` для чтения в Excel и копия отчета; в CRM при отправке исключать тех, у кого был депозит после `snapshot_utc`; действия с приоритетом 1 (много отказов подряд, отказ по лимиту, вывод отклонен или висит, документы) нужны сейчас;
   - правила стран из `geo_rules`: страны с правилами, что они изменили (`applied`: отказы по лимиту, исключенные из-за блокировки в банке, долгие выводы по законному сроку, выводы дольше законного срока), попытки депозита запрещенными в стране способами (`banned_in_data`), страны без правил;
   - оговорки из `caveats` простыми словами: чего не хватает в данных и что добавить в выгрузку.
   В режиме списка вместо денег и показателей скажи, сколько игроков в списке, сколько писать и сколько в контрольной группе, по каким причинам, прогноз из `forecast` (сколько вернутся без действий, сколько не хватает до нормы, вилка денег) и откуда вводные. Если профиля нет, скажи, что публичного бенчмарка нет, норма и прогноз появятся с 8-го дня, а сразу полный расчет даст выгрузка за 60-120 дней. Если в `summary.json` есть `effect`, назови разницу в долях вторых депозитов и вывод: разница больше случайной (z от 2), в пределах случайной или действия вредят (z до -2).
   Дай путь к `report.html` (копия по дате лежит в папке списка). Остальные файлы в той же папке: `scenarios.csv` и `segments.csv` (таблицы для Excel, в `segments.csv` колонка `significant` отделяет разрывы больше случайных), `excluded_rg.csv` (кто исключен по ответственной игре). Все суммы и штуки в ответе бери месячные (`lost_month`, `gap_players_month`). Не придумывай рыночных норм и не сравнивай с "рынком": все цифры только из данных пользователя.
7. **Предложи следующий шаг:** загрузить файлы действий в CRM как сегменты (колонки `action_code`, `priority`, `send_after_utc`), включить триггеры по сценариям (`references/scenarios.md`, раздел "Триггеры"), поставить ежедневный запуск по расписанию (раздел ниже).

## Ежедневный запуск по расписанию

Скрипт не требует Claude: по расписанию его запускает планировщик системы. Ставь задачу только после явного согласия пользователя: это постоянная настройка его компьютера.

1. **Папка.** Одна папка для выгрузок и результата. На Mac не на Рабочем столе и не в Документах или Загрузках: туда планировщик без отдельного разрешения не пустит. Например `~/second-deposit-data`.
2. **mapping.json** с масками и `"latest": true` у каждого файла (как в `mapping-csv-example.json`). Проверь одним ручным запуском.
3. **Задача.** Полный путь к python3 покажет `which python3`. Mac и Linux, добавить строку к существующим, не стирая их:
   `(crontab -l 2>/dev/null; echo '0 9 * * * <python3> <папка скилла>/scripts/sd_analyze.py --mapping <папка>/mapping.json --out <папка>/second-deposit --lang ru >> <папка>/second-deposit/daily.log 2>&1') | crontab -`
   Windows: `schtasks /create /tn second-deposit /sc daily /st 09:00 /tr "py <папка скилла>\scripts\sd_analyze.py --mapping <папка>\mapping.json --out <папка>\second-deposit --lang ru"`.
   Время ставь после того, как выгрузка обычно появляется в папке.
4. **Скажи пользователю:** куда класть выгрузки (с датой в имени, например `deposits_2026-10-17.csv`), где каждое утро лежит результат (`second-deposit/lists/<дата>/`), что лог без данных игроков пишется в `daily.log`, и как убрать задачу: `crontab -e` и удалить строку, в Windows `schtasks /delete /tn second-deposit`.

## Как читать цифры

- **Две части по времени.** Список собирается по свежим FTD за последние 72 часа: сигналы видны в первые часы (отказ в кассе и отклоненный вывод сразу, запрос документов в момент запроса, тяжелый бонус в момент FTD, "сгорел быстро" в первую сессию, долгий вывод через сутки после запроса, выигрыш и деньги на балансе через сутки после FTD).
- **Действие по состоянию.** Рекомендация зависит от того, что видно в данных: вывод в обработке (провести быстро) или уже выплачен (через 2-3 дня повод вернуться), бонус еще отыгрывается (напомнить) или проигран (оффер без тяжелого вейджера). Состояние лежит в колонке `state` списка. Расчет потерь идет по FTD старше 7 дней, потому что вернулся игрок или нет, видно только через 7 дней. Если пользователь спрашивает "когда смотреть", объясни именно так и предложи запускать каждый день или поставить те же сигналы триггерами в CRM.

- **Норма** это доля вторых депозитов у похожих игроков без проблемных сигналов: тот же размер FTD, источник и страна (если таких меньше 30, размер FTD и источник, потом только размер FTD). Недобор считается до нормы, поэтому это верхняя граница; вилка денег: минимум только сами вторые депозиты, максимум Sum Dep вернувшегося за 30 дней.
- **Эффект** считается только по контрольной группе: это единственная цифра того, сколько реально вернули действия.
- **Сценарий показывает, где теряются игроки, а не доказывает причину.** Причину проверяет тест с контрольной группой.
- **Срезы со сценариями не складываются:** это другой взгляд на тех же игроков.
- Ответственная игра: игроки с флагами из `rg_flags` исключены и из расчета, и из списка. Если флагов в выгрузке нет, скажи пользователю, что исключать их придется на стороне CRM.

Определения сценариев, пороги и формулы: `references/scenarios.md`. Форматы выгрузок и `mapping.json`: `references/data.md`.
