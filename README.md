# RP Call Desk — обзвоны в Discord (РП)

Сайт для **ролевой** процедуры отбора на руководящие должности:

1. Игрок **регистрируется** (RP-имя + Discord, без реальных номеров)
2. **Ведущий** в кабинете ведёт обзвон по скрипту/вопросам (в Discord)
3. **Результат** публикуется на табло
4. Все **входящие и исходящие** события пишутся в Firebase Realtime Database + вкладка «База / логи»

Стек: GitHub Pages (статика) + Firebase JS SDK 12 + Realtime Database.

## Быстрый старт

### 1. Firebase Rules (обязательно)

Firebase Console → **Realtime Database** → **Rules** → вставить из `database.rules.json` → Publish.

Без `.write: true` на `rp/...` заявки не сохранятся.

### 2. Ключи ведущего

В `firebase-config.js`:

```js
export const HOST_KEY = "rp-host-2026";   // кабинет ведущего
export const ADMIN_KEY = "rp-admin-2026"; // база / логи
```

Смените на свои.

### 3. GitHub Pages (репо KiGoIJ/HR-U)

Залить **все файлы этого архива в корень** `main`:

```
index.html
styles.css
app.js
firebase-config.js
database.rules.json
.nojekyll
README.md
```

Settings → Pages → Branch `main` → Folder **`/ (root)`**.

Сайт: `https://kigoij.github.io/HR-U/`

### 4. Проверка

1. Открой сайт → «Регистрация» → отправь тестовую заявку  
2. «Кабинет ведущего» → ключ `HOST_KEY` → сохрани результат  
3. «Результаты» — должна появиться запись  
4. «База / логи» → `ADMIN_KEY` — видны IN/OUT  

## Структура данных RTDB

```
rp/
  positions/      # должности
  scripts/        # скрипт обзвона
  applications/   # заявки (входящие)
  calls/          # карточки звонков (исходящие итоги обзвона)
  results/        # публичное табло
  logs/           # журнал IO (inbound | outbound | system)
```

## Важно

- Это **игровой** инструмент, не кадровый учёт IRL.
- Не собирайте реальные телефоны, паспорта, адреса.
- Текущие Rules открыты для учебного РП — для «боевого» контура включите Firebase Auth и ограничьте write.
- `HOST_KEY` / `ADMIN_KEY` видны в клиентском JS — это заглушка от случайных, не криптозащита.

## Локально

```bash
npx serve .
# или
python3 -m http.server 8080
```

Модули ES требуют http(s), не `file://`.
