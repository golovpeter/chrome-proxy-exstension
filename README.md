<h1 align="center">Chrome Proxy Manager</h1>

<p align="center">
  <strong>Manifest V3</strong> расширение для Chrome — маршрутизация трафика через HTTP, HTTPS или SOCKS прокси.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-latest-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-latest-61dafb?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/WXT-latest-ffab00?logo=googlechrome&logoColor=white" alt="WXT">
  <img src="https://img.shields.io/badge/Manifest-V3-green" alt="Manifest V3">
</p>

---

## Скриншоты

<table>
  <tr>
    <td align="center"><b>Popup</b></td>
    <td align="center"><b>Панель настроек</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/popup.png" width="300" alt="Popup"></td>
    <td><img src="docs/screenshots/dashboard.png" width="600" alt="Dashboard"></td>
  </tr>
</table>

## Возможности

- **Popup** — быстрое переключение режима прокси (HTTP / HTTPS / SOCKS / Disabled)
- **Дашборд настроек** — полная конфигурация всех параметров прокси
- **Режимы прокси** — `singleProxy` (один активный) или `perProtocol` (раздельные для HTTP/HTTPS/SOCKS)
- **SOCKS4 и SOCKS5**
- **Bypass-лист** — `<local>`, CIDR-диапазоны, wildcard-домены, host:port
- **Proxy-аутентификация** — автоматическая подстановка credentials через `chrome.webRequest.onAuthRequired`
- **Проверка подключения** — `fetch` к Google generate_204 с таймаутом
- **JSON импорт/экспорт** настроек
- **Сброс** настроек и credentials

## Установка

### Из исходников

```bash
npm install
npm run build
```

1. Откройте `chrome://extensions`
2. Включите **Developer mode**
3. Нажмите **Load unpacked**
4. Выберите папку `.output/chrome-mv3`

### Разработка

```bash
npm install
npm run dev        # WXT dev mode с HMR
npm test           # Vitest unit-тесты
npm run typecheck  # TypeScript проверка
npm run build      # Production-сборка
```

## Архитектура

```
entrypoints/
  background.ts          # Service worker — обработка сообщений, применение настроек
  popup/                  # Компактный popup для быстрого переключения
  options/                # Полноэкранный дашборд настроек

src/
  core/
    settings.ts           # Типы ProxySettings, значения по умолчанию
    proxyConfig.ts        # buildProxyConfig() → chrome.proxy API
    validation.ts         # Валидация host/port/settings
    bypassRules.ts        # Парсинг bypass-листа
    importExport.ts       # JSON экспорт/импорт
  platform/
    proxy.ts              # chrome.proxy.settings — apply/clear/check
    storage.ts            # chrome.storage.local через Promise
    auth.ts               # webRequest.onAuthRequired — proxy auth
    messages.ts           # Типизированный messaging popup/options ↔ background
  ui/
    components.tsx        # Переиспользуемые UI-компоненты
```

## Permissions

| Permission | Назначение |
|---|---|
| `proxy` | Управление прокси-настройками через `chrome.proxy` |
| `storage` | Хранение настроек и credentials в `chrome.storage.local` |
| `webRequest` | Перехват proxy auth challenges |
| `webRequestAuthProvider` | Ответ на auth challenges с credentials |
| `<all_urls>` | Наблюдение за auth challenges для проксированных запросов |

## Технический стек

- **[WXT](https://wxt.dev/)** — фреймворк для браузерных расширений
- **React** + **TypeScript** — UI и типобезопасность
- **Vitest** — unit-тесты
- **Chrome Manifest V3** — API расширений

## License

MIT
