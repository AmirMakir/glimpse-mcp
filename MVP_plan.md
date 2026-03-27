# Glimpse — Full Implementation Plan

> **Что это:** MCP сервер, который даёт AI coding агентам (Claude Code, Cursor, Windsurf) возможность видеть фронтенд через скриншоты, диффы, DOM инспекцию, взаимодействие с UI, accessibility аудит, performance метрики и многое другое.
>
> **Цель этого документа:** полная спецификация для реализации. Следуй этому плану сверху вниз по этапам.

---

## 1. Обзор проекта

### Стек

- **Язык:** TypeScript (strict mode)
- **Runtime:** Node.js >= 18
- **Браузер:** Playwright (Chromium по умолчанию, Firefox и WebKit опционально)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Сравнение изображений:** `pixelmatch` + `pngjs`
- **Accessibility:** `axe-core`
- **Точка входа:** `npx glimpse-mcp`

### Структура проекта

```
glimpse-mcp/
├── package.json
├── tsconfig.json
├── README.md
├── AGENT_GUIDE.md
├── src/
│   ├── index.ts              # CLI entry point: аргументы, запуск сервера
│   ├── server.ts             # MCP сервер: регистрация тулов, обработка запросов
│   ├── browser.ts            # Browser Manager: управление Playwright browser/page instances
│   ├── port-discovery.ts     # Автообнаружение dev сервера
│   ├── hmr.ts                # HMR WebSocket listener: ожидание hot reload
│   ├── config.ts             # Загрузка .glimpserc.json
│   ├── baseline-store.ts     # Persistent baselines: память + диск (.glimpse/)
│   ├── snapshot.ts           # DOM snapshot: сбор computed styles, bounds, текста
│   ├── diff-engine.ts        # Сравнение двух DOM snapshots
│   ├── utils.ts              # Viewport presets, форматирование, хелперы
│   ├── tools/
│   │   ├── screenshot.ts
│   │   ├── screenshot-all.ts
│   │   ├── page-outline.ts
│   │   ├── pixel-diff.ts
│   │   ├── smart-diff.ts
│   │   ├── dom-inspect.ts
│   │   ├── console-logs.ts
│   │   ├── interact.ts       # click, type, scroll, hover, select
│   │   ├── accessibility.ts  # axe-core аудит
│   │   ├── performance.ts    # Web Vitals метрики
│   │   ├── flow.ts           # User flow тестирование
│   │   └── sweep.ts          # Multi-page sweep
│   └── cli/
│       └── ci.ts             # CI/CD entry point
└── tests/
    ├── fixtures/
    │   ├── test-page.html
    │   ├── test-spa.html     # SPA с роутингом для тестов навигации
    │   └── test-form.html    # Форма для тестов interact
    ├── screenshot.test.ts
    ├── pixel-diff.test.ts
    ├── smart-diff.test.ts
    ├── dom-inspect.test.ts
    ├── page-outline.test.ts
    ├── console-logs.test.ts
    ├── interact.test.ts
    ├── accessibility.test.ts
    ├── performance.test.ts
    ├── flow.test.ts
    ├── sweep.test.ts
    ├── port-discovery.test.ts
    ├── hmr.test.ts
    └── config.test.ts
```

---

## 2. Порядок реализации

Строго по этапам, каждый этап — завершённый тестируемый кусок.

```
Фаза 1 — Ядро (смотрим)
  Этап 1:  Скелет проекта + Browser Manager
  Этап 2:  Port Discovery
  Этап 3:  Config (.glimpserc.json)
  Этап 4:  HMR listener
  Этап 5:  Screenshot
  Этап 6:  Screenshot All (multi-viewport)
  Этап 7:  Page Outline
  Этап 8:  Console Logs
  Этап 9:  DOM Inspect

Фаза 2 — Сравнения (диффы)
  Этап 10: Baseline Store (память + диск)
  Этап 11: Pixel Diff
  Этап 12: Smart Diff
  Этап 13: Advanced Smart Diff (z-index, contrast, orphaned, grouping)

Фаза 3 — Действия (взаимодействие)
  Этап 14: Interact (click, type, scroll, hover, select)
  Этап 15: User Flow
  Этап 16: Multi-page Sweep

Фаза 4 — Аудит
  Этап 17: Accessibility
  Этап 18: Performance метрики

Фаза 5 — Продвинутое
  Этап 19: Auth support
  Этап 20: Multi-browser (Firefox, WebKit)
  Этап 21: Component-level regression
  Этап 22: CI/CD режим

Фаза 6 — Сборка
  Этап 23: MCP Server (регистрация всех тулов)
  Этап 24: CLI entry point + npx
  Этап 25: AGENT_GUIDE.md
  Этап 26: README.md + финальные тесты
```

---

## 3. Детальная спецификация каждого этапа

---

### Этап 1: Скелет проекта + Browser Manager

#### package.json

```json
{
  "name": "glimpse-mcp",
  "version": "1.0.0",
  "description": "MCP server that gives AI coding agents visual feedback on frontend",
  "bin": {
    "glimpse-mcp": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest",
    "start": "node dist/index.js"
  },
  "keywords": ["mcp", "screenshot", "frontend", "ai", "playwright"],
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "playwright": "^1.52.0",
    "pixelmatch": "^5.3.0",
    "pngjs": "^7.0.0",
    "axe-core": "^4.10.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.5.0",
    "vitest": "^3.0.0"
  }
}
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

#### src/utils.ts — Viewport presets

```typescript
type ViewportName = 'mobile' | 'tablet' | 'desktop' | 'wide';

interface ViewportSize {
  width: number;
  height: number;
}

const VIEWPORTS: Record<ViewportName, ViewportSize> = {
  mobile:  { width: 375,  height: 812 },
  tablet:  { width: 768,  height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide:    { width: 1920, height: 1080 }
};
```

#### src/browser.ts — Browser Manager

Управляет жизненным циклом Playwright browser и page instances.

```typescript
type BrowserType = 'chromium' | 'firefox' | 'webkit';

interface BrowserManagerOptions {
  headless?: boolean;       // default: true
  browserType?: BrowserType; // default: 'chromium'
}

interface ConsoleEntry {
  type: 'log' | 'info' | 'warning' | 'error' | 'pageerror';
  text: string;
  timestamp: number;
  location?: string;
}
```

**Публичный API:**

```typescript
class BrowserManager {
  // Запускает browser нужного типа если ещё не запущен
  async ensureBrowser(type?: BrowserType): Promise<void>

  // Возвращает Page с заданным viewport.
  // reload=true → page.goto(url). reload=false → не перезагружает если URL совпадает.
  // При создании page — подписывается на console events.
  async getPage(url: string, viewport: ViewportSize, reload?: boolean): Promise<Page>

  // Возвращает собранные console логи. Опционально фильтрует и очищает.
  getConsoleLogs(filter?: string, clear?: boolean): ConsoleEntry[]

  // Очищает console логи
  clearConsoleLogs(): void

  // Закрывает browser и все pages
  async close(): Promise<void>

  // Закрывает конкретный browser type (для multi-browser)
  async closeBrowser(type: BrowserType): Promise<void>
}
```

**Внутренняя структура:**

```typescript
class BrowserManager {
  private browsers: Map<BrowserType, Browser> = new Map();
  private pages: Map<string, Page> = new Map();  // key: `${browserType}:${url}:${viewport}`
  private consoleLogs: ConsoleEntry[] = [];
  private mutex: Promise<void> = Promise.resolve(); // последовательное выполнение
}
```

**Mutex для последовательного доступа:**

Все методы работающие с page оборачиваются в mutex чтобы параллельные MCP запросы не конфликтовали:

```typescript
private async withLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  const prev = this.mutex;
  this.mutex = next;
  await prev;
  try {
    return await fn();
  } finally {
    release!();
  }
}
```

**Console logging при создании page:**

```typescript
page.on('console', msg => {
  const type = msg.type() === 'warn' ? 'warning' : msg.type();
  this.consoleLogs.push({
    type: type as ConsoleEntry['type'],
    text: msg.text(),
    timestamp: Date.now(),
    location: msg.location()?.url
      ? `${msg.location().url}:${msg.location().lineNumber}`
      : undefined
  });
});

page.on('pageerror', error => {
  this.consoleLogs.push({
    type: 'pageerror',
    text: error.message,
    timestamp: Date.now()
  });
});
```

**Стабилизация после навигации:**

```typescript
// После page.goto():
await page.waitForLoadState('networkidle').catch(() => {});
// Таймаут 10 секунд, если не дожидаемся — продолжаем.
// Плюс дополнительные 200ms для рендера:
await page.waitForTimeout(200);
```

**Отключение анимаций:**

```typescript
// После загрузки страницы — отключаем анимации для стабильных скриншотов
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `;
  document.head.appendChild(style);
});
```

#### Результат этапа:
- Проект инициализирован, зависимости установлены
- `BrowserManager` запускает Chromium, открывает страницу, меняет viewport, собирает console логи
- Юнит-тест: открыть `data:text/html,<h1>Hello</h1>`, убедиться что page загрузилась

---

### Этап 2: Port Discovery

#### src/port-discovery.ts

```typescript
interface DiscoveryResult {
  url: string;
  port: number;
}

async function resolveUrl(url?: string): Promise<DiscoveryResult>
```

**Логика:**

1. Если `url` передан и не пустой — валидируем, возвращаем.
2. Если `url` не передан:
   - Список портов: `[5173, 5174, 3000, 3001, 8080, 8081, 4200, 4321, 8000]`
   - Для каждого: `fetch(`http://localhost:${port}`)` с таймаутом 500ms.
   - Первый порт который ответил (любой HTTP status, главное не connection refused) — наш.
   - Кэшируем результат в переменную модуля.
3. Если ничего не найдено — ошибка: `"No dev server found on ports ${ports.join(', ')}. Start your dev server or pass url parameter."`

**Порядок портов** — Vite (5173, 5174), CRA/Next (3000, 3001), Webpack (8080, 8081), Angular (4200), Astro (4321), Python (8000).

#### Тест:
- Поднять HTTP сервер на произвольном порту, убедиться что `resolveUrl()` его находит
- Вызвать `resolveUrl("http://localhost:9999")` — возвращает переданный URL

---

### Этап 3: Config

#### src/config.ts

Загружает `.glimpserc.json` из текущей рабочей директории (cwd).

```typescript
interface GlimpseConfig {
  port?: number;                    // Порт dev сервера (вместо auto-discovery)
  viewports?: ViewportName[];       // Default viewports для screenshot_all. Default: ['mobile', 'tablet', 'desktop']
  baselineDir?: string;             // Папка для baselines. Default: '.glimpse/baselines'
  diffThreshold?: number;           // Порог pixelmatch. Default: 0.1
  ignoreSelectors?: string[];       // Элементы игнорируемые при diff (cookie баннеры, рекламные блоки)
  waitAfterNavigation?: number;     // ms ожидания после навигации. Default: 200
  maxPageHeight?: number;           // Максимальная высота full_page скриншота. Default: 10000
  auth?: AuthConfig;                // Авторизация (cookies, localStorage, headers)
  browser?: BrowserType;            // Default browser. Default: 'chromium'
}

interface AuthConfig {
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path?: string;
  }>;
  localStorage?: Record<string, string>;
  headers?: Record<string, string>;
}

function loadConfig(): GlimpseConfig
```

**Логика:**

1. Ищем `.glimpserc.json` в `process.cwd()`.
2. Если файл есть — парсим JSON, валидируем типы, мержим с дефолтами.
3. Если файла нет — возвращаем дефолты.
4. При невалидном JSON — warning в stderr, возвращаем дефолты.

**Интеграция с другими модулями:**
- `port-discovery.ts` — если `config.port` задан, используем его вместо сканирования.
- `browser.ts` — `config.browser` задаёт default browser type.
- `baseline-store.ts` — `config.baselineDir` задаёт путь к baselines.
- `diff-engine.ts` — `config.ignoreSelectors` исключает элементы из diff.

Config загружается один раз при старте сервера и передаётся в модули как зависимость.

---

### Этап 4: HMR Listener

#### src/hmr.ts

Слушает HMR WebSocket и позволяет дождаться завершения hot reload перед скриншотом.

```typescript
interface HMRListener {
  // Начинает слушать HMR events на странице
  attach(page: Page): Promise<void>

  // Ждёт следующего HMR update. Таймаут = maxWait ms.
  // Возвращает true если update произошёл, false если таймаут.
  waitForUpdate(maxWait?: number): Promise<boolean>

  // Отключается
  detach(): void
}

function createHMRListener(): HMRListener
```

**Логика:**

Playwright позволяет перехватывать WebSocket через CDP (Chrome DevTools Protocol):

```typescript
// Подписываемся на WebSocket фреймы через page
page.on('websocket', ws => {
  // Проверяем что это HMR WebSocket
  // Vite: URL содержит '/@vite/client' или порт 24678
  // Webpack: URL содержит '/ws' или '/webpack-dev-server'
  // Next.js: URL содержит '/_next/webpack-hmr'
  
  ws.on('framereceived', event => {
    const data = event.payload;
    try {
      const msg = JSON.parse(data.toString());
      // Vite: msg.type === 'update' или msg.type === 'full-reload'
      // Webpack: msg.type === 'ok' или msg.type === 'still-ok'
      // Next.js: msg.action === 'built' или msg.action === 'sync'
      if (isHMRUpdateMessage(msg)) {
        resolveCurrentWait();
      }
    } catch {}
  });
});
```

**Распознавание HMR сообщений:**

```typescript
function isHMRUpdateMessage(msg: any): boolean {
  // Vite
  if (msg.type === 'update' || msg.type === 'full-reload') return true;
  // Webpack Dev Server
  if (msg.type === 'ok' || msg.type === 'still-ok') return true;
  // Next.js
  if (msg.action === 'built' || msg.action === 'sync') return true;
  // Turbopack
  if (msg.type === 'turbopack-connected' || msg.type === 'issues') return true;
  return false;
}
```

**Использование в тулах:**

Когда тул делает скриншот с `reload: true`:
1. Если HMR listener подключён и обнаружил WebSocket — вызываем `hmrListener.waitForUpdate(5000)` перед скриншотом.
2. После получения update event — ждём ещё `config.waitAfterNavigation` ms (default 200ms) для завершения рендера.
3. Если HMR WebSocket не обнаружен — fallback на обычный `page.reload()` + `waitForLoadState`.

**Fallback:** если за 5 секунд HMR event не пришёл — делаем обычный reload. Не блокируем агента бесконечно.

---

### Этап 5: Screenshot

#### src/tools/screenshot.ts

**MCP tool:**

```typescript
server.tool(
  "screenshot",
  "Take a screenshot of a web page or a specific element. Returns the image. Use this to see what the UI looks like.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector to screenshot a specific element." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"], description: "Viewport size. Default: desktop." },
    full_page: { type: "boolean", description: "Capture full scrollable page. Default: false." },
    reload: { type: "boolean", description: "Force page reload. Default: true on first call." },
    browser: { type: "string", enum: ["chromium", "firefox", "webkit"], description: "Browser engine. Default: chromium." }
  },
  handler
);
```

**Логика:**

1. `resolveUrl(input.url)`.
2. `browserManager.getPage(url, viewport, reload)`.
3. Если auth есть в config — применяем перед навигацией (см. этап 19).
4. Если HMR listener активен — ждём update.
5. Если `selector`:
   - `page.waitForSelector(selector, { timeout: 5000 })`.
   - `element.screenshot({ type: 'png' })`.
6. Иначе:
   - `page.screenshot({ type: 'png', fullPage: full_page })`.
   - Если fullPage и высота > `config.maxPageHeight` → `clip` по maxPageHeight, добавляем warning.
7. Конвертим в base64, возвращаем image + text метаданные.

**Возвращает:**

```typescript
[
  { type: "image", data: "<base64 PNG>", mimeType: "image/png" },
  { type: "text", text: "Screenshot: 1280x800, http://localhost:5173, desktop, chromium" }
]
```

---

### Этап 6: Screenshot All

#### src/tools/screenshot-all.ts

**MCP tool:**

```typescript
server.tool(
  "screenshot_all",
  "Take screenshots at multiple viewports in one call. Returns all images. Use to check responsive design.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector to screenshot a specific element." },
    full_page: { type: "boolean", description: "Capture full scrollable page. Default: false." },
    viewports: {
      type: "array",
      items: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] },
      description: "Viewports to capture. Default from config or ['mobile', 'tablet', 'desktop']."
    }
  },
  handler
);
```

**Логика:**

1. Viewports из input, или из config, или default `['mobile', 'tablet', 'desktop']`.
2. Для каждого viewport — меняем `page.setViewportSize()`, ждём 200ms, делаем скриншот.
3. Последовательно на одной page.

**Возвращает:**

```typescript
[
  { type: "text", text: "=== mobile (375x812) ===" },
  { type: "image", data: "<base64>", mimeType: "image/png" },
  { type: "text", text: "=== tablet (768x1024) ===" },
  { type: "image", data: "<base64>", mimeType: "image/png" },
  { type: "text", text: "=== desktop (1280x800) ===" },
  { type: "image", data: "<base64>", mimeType: "image/png" }
]
```

---

### Этап 7: Page Outline

#### src/tools/page-outline.ts

**MCP tool:**

```typescript
server.tool(
  "page_outline",
  "Get page structure: sections, headings, nav links with positions and sizes. Use FIRST on unfamiliar or long pages before screenshotting specific sections.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"], description: "Viewport. Default: desktop." },
    reload: { type: "boolean", description: "Force reload. Default: true on first call." }
  },
  handler
);
```

**Собираем одним `page.evaluate()`:**

**1. Секции** — крупные блоки:

```typescript
const sectionSelectors = [
  'header', 'footer', 'main', 'nav', 'aside',
  'section', 'article',
  '[data-section]', '[data-testid]',
  '[id]:not(script):not(style):not(link):not(meta)'
];

interface SectionInfo {
  selector: string;       // "section.hero", "#pricing", "footer"
  tag: string;
  y: number;
  height: number;
  width: number;
  text_preview: string;   // первые 60 символов
  children_count: number;
}
```

**2. Заголовки** — `h1`-`h6`:

```typescript
interface HeadingInfo {
  level: number;
  text: string;
  y: number;
  parent_selector: string;  // в какой секции
}
```

**3. Nav ссылки:**

```typescript
// Из nav, header, footer + все внутренние ссылки (href начинается с / или ./ или #)
interface LinkInfo {
  text: string;
  href: string;
  location: string;  // "nav", "header", "footer", "body"
}
```

**Лимиты:** секции max 30, заголовки max 30, ссылки max 20 (дедупликация по href). Сортировка по y.

**Генерация selector:**
1. `id` → `#myId`
2. `data-testid` → `[data-testid="value"]`
3. Иначе → `tag.class1.class2` с уточнением через `:nth-of-type(n)` если не уникальный.

**Формат вывода (только текст):**

```
Page outline: http://localhost:5173/
Viewport: desktop (1280x800)
Page height: 3200px

## Sections (top to bottom)

  header             y=0      h=80px    "Logo · Home · Features · Pricing"
  section.hero       y=80     h=600px   "AI-Powered Analytics for Teams"
  section#features   y=680    h=800px   "Everything you need"
  section.pricing    y=1480   h=640px   "Simple pricing"
  footer             y=2640   h=360px   "© 2025 Acme Inc"

## Headings

  h1  "AI-Powered Analytics"              (in section.hero)
  h2  "Everything you need"               (in section#features)
  h2  "Simple pricing"                    (in section.pricing)

## Nav links

  "Home"        → /
  "Features"    → /features
  "Pricing"     → /pricing
  "Login"       → /login

Tip: Use screenshot({ selector: "section.pricing" }) to capture a specific section.
```

---

### Этап 8: Console Logs

#### src/tools/console-logs.ts

**MCP tool:**

```typescript
server.tool(
  "console_logs",
  "Get browser console output: logs, warnings, errors, uncaught exceptions. Use to check for JS errors.",
  {
    url: { type: "string", description: "Page URL. Opens page to start collecting if not open yet." },
    type: { type: "string", enum: ["all", "error", "warning", "log", "info"], description: "Filter by type. Default: all." },
    clear: { type: "boolean", description: "Clear log after reading. Default: false." }
  },
  handler
);
```

**Логика:**

1. Если url передан и страница не открыта — открываем (чтобы начать сбор).
2. `browserManager.getConsoleLogs(filter, clear)`.
3. Форматируем:

```
Console logs (5 entries, showing: all):

[error] Uncaught TypeError: Cannot read property 'map' of undefined
  at App.jsx:42

[warning] React key warning: Each child should have unique "key" prop.
  at ProductList.jsx:18

[log] App initialized
[log] Fetched 24 products
[info] Service worker registered
```

Если логов нет: `"No console logs recorded."` Если страница не открыта и url не передан: `"No page open. Pass url or call screenshot first."`

---

### Этап 9: DOM Inspect

#### src/tools/dom-inspect.ts

**MCP tool:**

```typescript
server.tool(
  "dom_inspect",
  "Inspect a DOM element: bounding box, computed CSS styles, attributes, text content, children count. Use to understand element structure.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector of element to inspect. Required." },
    reload: { type: "boolean", description: "Force reload. Default: true on first call." }
  },
  handler
);
```

**Собираем через `page.evaluate()`:**

- `getBoundingClientRect()` — x, y, width, height
- `getComputedStyle()` — выбранные свойства (список ниже)
- `textContent?.slice(0, 200)` — обрезанный текст
- `children.length`
- `attributes` — все
- `tagName`

**Список свойств для computed styles:**

```typescript
const STYLE_PROPERTIES = [
  'display', 'position', 'top', 'left', 'right', 'bottom',
  'flexDirection', 'justifyContent', 'alignItems', 'flexWrap',
  'gridTemplateColumns', 'gridTemplateRows',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'border', 'borderRadius',
  'backgroundColor', 'color', 'opacity',
  'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'textAlign',
  'overflow', 'overflowX', 'overflowY',
  'zIndex', 'visibility',
  'gap', 'rowGap', 'columnGap',
  'boxShadow', 'transform'
];
```

**Формат вывода:**

```
Element: .pricing-card
Tag: div
Bounding box: x=120, y=340, width=320, height=480
Text content: "Pro Plan — $29/mo — Best for teams..."
Children: 5 direct children

Computed styles:
  display: flex
  flex-direction: column
  position: relative
  width: 320px
  padding: 24px
  margin: 0px 16px
  background-color: rgb(255, 255, 255)
  border-radius: 12px
  font-size: 16px
  color: rgb(17, 24, 39)

Attributes:
  class="pricing-card"
  data-plan="pro"
```

---

### Этап 10: Baseline Store

#### src/baseline-store.ts

Хранит baselines в памяти И на диске. Диск = персистентность между сессиями.

```typescript
interface Baseline {
  screenshot: Buffer;
  domSnapshot?: DOMSnapshot;  // для smart diff
  timestamp: number;
  viewport: ViewportName;
  url: string;
}

class BaselineStore {
  private memory: Map<string, Baseline> = new Map();
  private diskDir: string;  // из config.baselineDir, default '.glimpse/baselines'

  constructor(config: GlimpseConfig) {}

  // Сохраняет baseline в память и на диск
  async save(name: string, baseline: Baseline): Promise<void>

  // Загружает baseline: сначала из памяти, потом с диска
  async load(name: string): Promise<Baseline | null>

  // Список всех baselines
  async list(): Promise<string[]>

  // Удаляет baseline
  async delete(name: string): Promise<void>
}
```

**Формат на диске:**

```
.glimpse/
  baselines/
    homepage-desktop.png
    homepage-desktop.json    # { url, viewport, timestamp, domSnapshot }
    pricing-mobile.png
    pricing-mobile.json
```

**Генерация имени по умолчанию:**

Если `name` не передан — генерируем из URL path + viewport:
- `http://localhost:5173/pricing` + `desktop` → `pricing-desktop`
- `http://localhost:5173/` + `mobile` → `homepage-mobile`
- `http://localhost:5173/about` + `tablet` → `about-tablet`

```typescript
function generateBaselineName(url: string, viewport: ViewportName, selector?: string): string {
  const path = new URL(url).pathname;
  const pageName = path === '/' ? 'homepage' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  const selectorPart = selector ? `-${selector.replace(/[^a-zA-Z0-9]/g, '')}` : '';
  return `${pageName}${selectorPart}-${viewport}`;
}
```

**Создание директории:** при первом save создаём `.glimpse/baselines/` если не существует (`fs.mkdirSync({ recursive: true })`).

---

### Этап 11: Pixel Diff

#### src/tools/pixel-diff.ts

**MCP tool:**

```typescript
server.tool(
  "pixel_diff",
  "Compare screenshots pixel-by-pixel. First save_baseline, then make changes, then compare. Returns diff image with changes in red.",
  {
    action: { type: "string", enum: ["save_baseline", "compare"], description: "save_baseline or compare." },
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector for element-level diff." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"], description: "Viewport. Default: desktop." },
    name: { type: "string", description: "Baseline name. Auto-generated if omitted." }
  },
  handler
);
```

**Логика `save_baseline`:**
1. Делаем скриншот.
2. `baselineStore.save(name, { screenshot, timestamp, viewport, url })`.
3. Возвращаем скриншот + подтверждение.

**Логика `compare`:**
1. `baselineStore.load(name)`. Если null → ошибка.
2. Делаем текущий скриншот.
3. Сравниваем через pixelmatch:

```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const img1 = PNG.sync.read(baselineBuffer);
const img2 = PNG.sync.read(currentBuffer);

if (img1.width !== img2.width || img1.height !== img2.height) {
  // Сообщаем об изменении размеров
}

const diff = new PNG({ width: img1.width, height: img1.height });
const numDiffPixels = pixelmatch(
  img1.data, img2.data, diff.data,
  img1.width, img1.height,
  { threshold: config.diffThreshold ?? 0.1 }
);

const diffPercent = (numDiffPixels / (img1.width * img1.height) * 100).toFixed(2);
```

4. Возвращаем: текст с процентом + diff image + текущий скриншот.

**ignoreSelectors:** если в config есть `ignoreSelectors` — перед скриншотом скрываем эти элементы:

```typescript
if (config.ignoreSelectors?.length) {
  await page.evaluate((selectors) => {
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
  }, config.ignoreSelectors);
}
```

---

### Этап 12: Smart Diff

#### src/snapshot.ts — DOM Snapshot

```typescript
interface ElementSnapshot {
  selector: string;
  tag: string;
  bounds: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  text: string;        // до 100 символов
  visible: boolean;
  children: number;
}

interface DOMSnapshot {
  url: string;
  viewport: { width: number; height: number };
  timestamp: number;
  elements: ElementSnapshot[];
  pageHeight: number;
}
```

**Какие элементы собираем:**
- Все с `id`, `class`, `data-testid`, `data-component`
- Семантические: `header`, `nav`, `main`, `section`, `article`, `footer`, `aside`, `h1-h6`, `button`, `a`, `img`, `form`, `input`
- НЕ: `script`, `style`, `meta`, `link`, внутренние `svg`/`path`
- Элементы из `config.ignoreSelectors` — пропускаем
- Максимум 200 элементов. Приоритет: id/data-testid > class > семантические

**Генерация unique selector:** id → data-testid → tag.classes с :nth-of-type если не уникален.

Весь сбор — один `page.evaluate()`.

#### src/diff-engine.ts — Сравнение snapshots

```typescript
interface DOMChange {
  type: 'moved' | 'resized' | 'style-changed' | 'added' | 'removed' | 'text-changed';
  selector: string;
  description: string;
  details?: Record<string, { before: string; after: string }>;
  severity: 'info' | 'warning' | 'error';
}

function compareDOMSnapshots(before: DOMSnapshot, after: DOMSnapshot): DOMChange[]
```

**Логика:**

1. Сопоставляем элементы по selector.
2. Для каждой пары:
   - bounds x/y изменились > 2px → `moved`
   - bounds width/height изменились > 2px → `resized`
   - styles изменились → `style-changed`
   - textContent изменился → `text-changed`
3. В before но не в after → `removed`
4. В after но не в before → `added`
5. Порог 2px — чтобы не ловить субпиксельные сдвиги.

**Приоритет вывода:** removed/added → moved/resized → style-changed → text-changed.

#### src/tools/smart-diff.ts

**MCP tool:**

```typescript
server.tool(
  "smart_diff",
  "Compare before/after with pixel diff AND DOM analysis. Returns structured changes: which elements moved, resized, changed styles. Much more useful than pixel_diff. First save_baseline, then make changes, then compare.",
  {
    action: { type: "string", enum: ["save_baseline", "compare"] },
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector to scope diff to a section." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] },
    name: { type: "string", description: "Baseline name. Auto-generated if omitted." }
  },
  handler
);
```

**save_baseline:** скриншот + DOM snapshot → `baselineStore.save()`.

**compare:** текущий скриншот + DOM snapshot → pixelmatch для diff image → `compareDOMSnapshots()` для текстового отчёта.

**Формат вывода:**

```
Smart diff: 7 changes detected

Layout:
  • section.hero — resized: height 400px → 320px (-80px)
  • button.cta — moved: y 380px → 300px (-80px)

Styles:
  • h1.title — font-size: 32px → 48px, font-weight: 400 → 700
  • .pricing-card — padding: 16px → 24px

Added:
  • div.badge — new element at (200, 120), 80x24px

Page: height 1400px → 1320px (-80px)
Viewport: desktop (1280x800)
```

Плюс diff image + текущий скриншот.

---

### Этап 13: Advanced Smart Diff

Расширяем `diff-engine.ts` дополнительными проверками.

#### Z-index конфликты

```typescript
interface OverlapIssue {
  element1: string;  // selector
  element2: string;
  overlapArea: { x: number; y: number; width: number; height: number };
  zIndex1: number;
  zIndex2: number;
}
```

Для всех visible элементов с `position: absolute|fixed|sticky` и явным zIndex — проверяем пересечение bounds. Если два элемента пересекаются и оба видимы — это потенциальный z-index конфликт.

#### Contrast ratio

```typescript
interface ContrastIssue {
  selector: string;
  foreground: string;  // color
  background: string;  // backgroundColor
  ratio: number;
  required: number;    // WCAG AA: 4.5 для текста, 3 для крупного текста
  passes: boolean;
}
```

Для элементов с текстом: берём `color` и `backgroundColor` из computed styles, считаем relative luminance и contrast ratio по WCAG формуле. Если ratio < 4.5 (или < 3 для font-size >= 24px или font-size >= 18.66px bold) — проблема.

```typescript
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
```

#### Orphaned elements

Элементы у которых bounds выходят за viewport (x + width < 0, x > viewportWidth, y + height < 0, etc). Это часто ошибка layout'а.

#### Группировка связанных изменений

Если несколько элементов сдвинулись на одинаковое расстояние в одном направлении — группируем: "5 elements in .card-grid shifted down by 32px (likely caused by header height change)".

```typescript
function groupRelatedChanges(changes: DOMChange[]): GroupedChange[] {
  // 1. Собираем все 'moved' changes
  // 2. Кластеризуем по direction + distance (±3px tolerance)
  // 3. Если в кластере > 2 элемента — группируем
  // 4. Ищем возможную причину: родительский элемент который resized
}
```

**Формат вывода при compare:** добавляется секция Issues:

```
Issues:
  ⚠ Contrast: button.cta — ratio 2.8:1, required 4.5:1 (white text on light blue)
  ⚠ Overlap: div.modal overlaps div.header (z-index: 10 vs 100)
  ⚠ Orphaned: div.tooltip at x=-120 is off-screen

Grouped:
  • 4 cards in .pricing-grid shifted down 32px (section.hero grew by 32px)
```

---

### Этап 14: Interact

#### src/tools/interact.ts

Один тул с параметром `action`.

**MCP tool:**

```typescript
server.tool(
  "interact",
  "Interact with the page: click, type, scroll, hover, select. Returns a screenshot after the action. Use to test user flows and UI states.",
  {
    action: {
      type: "string",
      enum: ["click", "type", "scroll", "hover", "select", "press_key"],
      description: "Action to perform."
    },
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector of target element. Required for click, type, hover, select." },
    text: { type: "string", description: "Text to type (for 'type' action) or key to press (for 'press_key' action)." },
    value: { type: "string", description: "Value to select (for 'select' action in dropdowns)." },
    direction: { type: "string", enum: ["up", "down", "left", "right"], description: "Scroll direction (for 'scroll' action). Default: down." },
    amount: { type: "number", description: "Scroll amount in pixels (for 'scroll' action). Default: 500." },
    screenshot: { type: "boolean", description: "Return screenshot after action. Default: true." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] }
  },
  handler
);
```

**Логика по действиям:**

```typescript
switch (input.action) {
  case 'click':
    await page.click(selector, { timeout: 5000 });
    break;

  case 'type':
    // Очищаем поле перед вводом
    await page.fill(selector, input.text ?? '');
    break;

  case 'scroll':
    const direction = input.direction ?? 'down';
    const amount = input.amount ?? 500;
    const deltaX = direction === 'right' ? amount : direction === 'left' ? -amount : 0;
    const deltaY = direction === 'down' ? amount : direction === 'up' ? -amount : 0;
    await page.mouse.wheel(deltaX, deltaY);
    break;

  case 'hover':
    await page.hover(selector, { timeout: 5000 });
    break;

  case 'select':
    await page.selectOption(selector, input.value ?? '');
    break;

  case 'press_key':
    await page.keyboard.press(input.text ?? 'Enter');
    break;
}

// Ждём стабилизации после действия
await page.waitForTimeout(300);
await page.waitForLoadState('networkidle').catch(() => {});
```

**Всегда возвращаем скриншот** (если `screenshot !== false`):
```typescript
[
  { type: "text", text: "Action: clicked button.submit" },
  { type: "image", data: "<base64>", mimeType: "image/png" }
]
```

**Обработка ошибок:**
- Элемент не найден → `"Element not found: ${selector}"`
- Элемент не видим/не кликабелен → `"Element not interactable: ${selector}. It may be hidden or overlapped."`

---

### Этап 15: User Flow

#### src/tools/flow.ts

**MCP tool:**

```typescript
server.tool(
  "flow",
  "Execute a multi-step user flow. Performs actions sequentially and returns screenshots after each step. Use to test complete user journeys like login, checkout, etc.",
  {
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["navigate", "click", "type", "scroll", "hover", "select", "press_key", "wait", "screenshot"] },
          url: { type: "string", description: "URL for navigate action." },
          selector: { type: "string", description: "CSS selector for click/type/hover/select/wait." },
          text: { type: "string", description: "Text for type, key for press_key." },
          value: { type: "string", description: "Value for select." },
          direction: { type: "string", enum: ["up", "down", "left", "right"] },
          amount: { type: "number" },
          timeout: { type: "number", description: "Timeout in ms for wait action. Default: 5000." }
        }
      },
      description: "Array of steps to execute sequentially."
    },
    screenshot_each: { type: "boolean", description: "Take screenshot after every step. Default: true." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] },
    url: { type: "string", description: "Starting URL if first step is not navigate." }
  },
  handler
);
```

**Действия:**

- `navigate` — `page.goto(url)`, ждём networkidle
- `click`, `type`, `scroll`, `hover`, `select`, `press_key` — как в interact
- `wait` — `page.waitForSelector(selector, { timeout })`. Если timeout — ошибка но flow продолжается.
- `screenshot` — явный скриншот без действия

**Логика:**

```typescript
const results = [];

for (let i = 0; i < steps.length; i++) {
  const step = steps[i];
  try {
    // Выполняем действие
    await executeStep(page, step);

    // Скриншот если нужно
    if (input.screenshot_each !== false || step.action === 'screenshot') {
      const buffer = await page.screenshot({ type: 'png' });
      results.push(
        { type: "text", text: `Step ${i + 1}/${steps.length}: ${step.action}${step.selector ? ` on ${step.selector}` : ''}` },
        { type: "image", data: buffer.toString('base64'), mimeType: "image/png" }
      );
    } else {
      results.push(
        { type: "text", text: `Step ${i + 1}/${steps.length}: ${step.action} ✓` }
      );
    }
  } catch (error) {
    results.push(
      { type: "text", text: `Step ${i + 1}/${steps.length}: ${step.action} ✗ — ${error.message}` }
    );
    // Делаем скриншот состояния ошибки
    const buffer = await page.screenshot({ type: 'png' }).catch(() => null);
    if (buffer) {
      results.push({ type: "image", data: buffer.toString('base64'), mimeType: "image/png" });
    }
    // Продолжаем flow, не прерываемся
  }
}

results.push({ type: "text", text: `Flow complete: ${steps.length} steps` });
return results;
```

---

### Этап 16: Multi-page Sweep

#### src/tools/sweep.ts

**MCP tool:**

```typescript
server.tool(
  "sweep",
  "Scan multiple pages: take screenshots, collect console errors, run accessibility audit on each. Returns a consolidated report.",
  {
    urls: {
      type: "array",
      items: { type: "string" },
      description: "Array of URLs or paths to check. Paths like '/about' are resolved against the detected dev server."
    },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"], description: "Viewport. Default: desktop." },
    checks: {
      type: "array",
      items: { type: "string", enum: ["screenshot", "console", "accessibility"] },
      description: "What to check on each page. Default: ['screenshot', 'console']."
    }
  },
  handler
);
```

**Логика:**

1. `resolveUrl()` для получения base URL.
2. Для каждого URL/path:
   - Если path (начинается с `/`) — преобразуем: `${baseUrl}${path}`
   - `page.goto(url)`
   - Если checks включает `screenshot` → делаем скриншот
   - Если checks включает `console` → собираем ошибки (очищаем между страницами)
   - Если checks включает `accessibility` → запускаем axe-core аудит
3. Собираем отчёт.

**Формат вывода:**

```
Sweep: 5 pages checked

✓ / (homepage)
  Screenshot: 1280x800
  Console: 0 errors, 1 warning

✗ /about
  Screenshot: 1280x800
  Console: 2 errors
    [error] Failed to fetch /api/team
    [error] Uncaught TypeError at about.js:15
  Accessibility: 1 issue
    [serious] Image missing alt text: img.team-photo

✓ /pricing
  Screenshot: 1280x800
  Console: 0 errors

✓ /login
  Screenshot: 1280x800
  Console: 0 errors

✗ /dashboard
  Page failed to load: 404 Not Found
```

Плюс скриншоты каждой страницы как image в массиве результатов.

---

### Этап 17: Accessibility

#### src/tools/accessibility.ts

**MCP tool:**

```typescript
server.tool(
  "accessibility",
  "Run accessibility audit on the page using axe-core (WCAG 2.1 standard). Returns list of issues with severity, affected elements, and fix suggestions.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    selector: { type: "string", description: "CSS selector to scope audit to a section." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "WCAG tags to check. Default: ['wcag2a', 'wcag2aa']. Options: wcag2a, wcag2aa, wcag2aaa, best-practice."
    }
  },
  handler
);
```

**Логика:**

1. Получаем page.
2. Инжектим axe-core в страницу:

```typescript
// Читаем axe-core из node_modules
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
await page.evaluate(axeSource);
```

3. Запускаем аудит:

```typescript
const results = await page.evaluate(async (options) => {
  // @ts-ignore — axe добавлен глобально
  return await axe.run(options.selector || document, {
    runOnly: {
      type: 'tag',
      values: options.tags || ['wcag2a', 'wcag2aa']
    }
  });
}, { selector: input.selector, tags: input.tags });
```

4. Форматируем результат.

**Формат вывода:**

```
Accessibility audit: http://localhost:5173/pricing
12 checks passed, 4 issues found

[critical] button-name: Buttons must have discernible text
  Element: button.icon-btn at (340, 520)
  Fix: Add aria-label or visible text to the button
  Help: https://dequeuniversity.com/rules/axe/4.10/button-name

[serious] color-contrast: Elements must have sufficient color contrast
  Element: p.subtitle at (120, 280)
  Foreground: #999999, Background: #ffffff, Ratio: 2.8:1 (required 4.5:1)
  Fix: Change text color to at least #767676 for 4.5:1 ratio

[moderate] image-alt: Images must have alternate text
  Element: img.hero-bg at (0, 80)
  Fix: Add alt attribute describing the image content

[minor] heading-order: Heading levels should increase by one
  Element: h4.card-title at (120, 600)
  Fix: Use h3 instead (previous heading is h2)

Summary: 1 critical, 1 serious, 1 moderate, 1 minor
```

---

### Этап 18: Performance

#### src/tools/performance.ts

**MCP tool:**

```typescript
server.tool(
  "performance",
  "Measure page performance: Web Vitals (LCP, FCP, CLS), resource counts and sizes. Use to find performance bottlenecks.",
  {
    url: { type: "string", description: "Page URL. Auto-detected if omitted." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] }
  },
  handler
);
```

**Логика:**

Нужен свежий page load (не из кеша) для точных метрик:

```typescript
// Создаём новый page context для чистых метрик
const context = await browser.newContext();
const page = await context.newPage();
await page.setViewportSize(viewport);

// Собираем сетевые запросы
const requests: Array<{ url: string; size: number; type: string; duration: number }> = [];
page.on('response', async response => {
  const size = (await response.body().catch(() => Buffer.alloc(0))).length;
  requests.push({
    url: response.url(),
    size,
    type: response.request().resourceType(),
    duration: 0  // заполним из performance entries
  });
});

// Навигация
await page.goto(url, { waitUntil: 'networkidle' });

// Собираем Web Vitals
const metrics = await page.evaluate(() => {
  return new Promise(resolve => {
    const result: any = {};

    // FCP
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    result.fcp = fcp ? fcp.startTime : null;

    // LCP — через PerformanceObserver (может быть уже записан)
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    result.lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;

    // CLS
    let cls = 0;
    const clsEntries = performance.getEntriesByType('layout-shift');
    clsEntries.forEach((entry: any) => {
      if (!entry.hadRecentInput) cls += entry.value;
    });
    result.cls = cls;

    // Navigation timing
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) {
      result.ttfb = nav.responseStart - nav.requestStart;
      result.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
      result.load = nav.loadEventEnd - nav.startTime;
    }

    resolve(result);
  });
});

await context.close();
```

**Формат вывода:**

```
Performance: http://localhost:5173/
Viewport: desktop (1280x800)

Web Vitals:
  FCP:  0.8s  ✓ Good (< 1.8s)
  LCP:  2.4s  ⚠ Needs improvement (< 2.5s)
  CLS:  0.02  ✓ Good (< 0.1)
  TTFB: 120ms ✓ Good (< 800ms)

Loading:
  DOM Content Loaded: 1.2s
  Full Load: 3.1s

Resources: 42 requests, 2.8 MB total
  JavaScript: 12 files, 1.4 MB
  CSS:        3 files, 180 KB
  Images:     18 files, 1.1 MB
  Fonts:      4 files, 120 KB
  Other:      5 files, 20 KB

Largest resources:
  1. hero-image.jpg          480 KB  (image)
  2. vendor.bundle.js        320 KB  (script)
  3. main.bundle.js          280 KB  (script)

Suggestions:
  • LCP close to threshold (2.4s). Largest element: img.hero-image. Consider lazy loading or smaller format (webp).
  • 12 JS files — consider code splitting or bundling.
  • hero-image.jpg is 480KB — consider compressing or using webp.
```

**Пороги Web Vitals:**
- FCP: Good < 1.8s, Needs improvement < 3.0s, Poor >= 3.0s
- LCP: Good < 2.5s, Needs improvement < 4.0s, Poor >= 4.0s
- CLS: Good < 0.1, Needs improvement < 0.25, Poor >= 0.25
- TTFB: Good < 800ms, Needs improvement < 1800ms, Poor >= 1800ms

---

### Этап 19: Auth Support

#### Интеграция в browser.ts

Auth конфигурация берётся из `.glimpserc.json` или передаётся в параметрах тула.

**Применение auth перед навигацией:**

```typescript
async applyAuth(page: Page, context: BrowserContext, auth: AuthConfig, url: string): Promise<void> {
  // 1. Cookies
  if (auth.cookies?.length) {
    await context.addCookies(auth.cookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain || new URL(url).hostname,
      path: c.path || '/'
    })));
  }

  // 2. localStorage — нужно сначала загрузить страницу (пустую), потом установить
  if (auth.localStorage && Object.keys(auth.localStorage).length > 0) {
    await page.goto(url);  // Загружаем страницу чтобы получить origin
    await page.evaluate((items) => {
      Object.entries(items).forEach(([key, value]) => {
        localStorage.setItem(key, value as string);
      });
    }, auth.localStorage);
    // После установки localStorage — reload чтобы приложение подхватило
    await page.reload();
  }

  // 3. Extra headers
  if (auth.headers && Object.keys(auth.headers).length > 0) {
    await page.setExtraHTTPHeaders(auth.headers);
  }
}
```

**Добавляем параметр auth во все тулы:**

```typescript
auth: {
  type: "object",
  properties: {
    cookies: { type: "array", items: { type: "object", properties: { name: { type: "string" }, value: { type: "string" }, domain: { type: "string" } } } },
    localStorage: { type: "object", additionalProperties: { type: "string" } },
    headers: { type: "object", additionalProperties: { type: "string" } }
  },
  description: "Auth credentials. Overrides config auth. Optional."
}
```

Auth из параметров тула имеет приоритет над auth из config.

---

### Этап 20: Multi-browser

#### Расширение browser.ts

BrowserManager уже хранит `Map<BrowserType, Browser>`. Нужно:

1. При запросе конкретного browser type — запускаем нужный engine:

```typescript
async ensureBrowser(type: BrowserType = 'chromium'): Promise<void> {
  if (this.browsers.has(type)) return;

  const playwright = await import('playwright');
  const browserType = playwright[type];  // playwright.chromium, playwright.firefox, playwright.webkit
  const browser = await browserType.launch({ headless: this.options.headless ?? true });
  this.browsers.set(type, browser);
}
```

2. Добавить параметр `browser` во все тулы (уже сделано в screenshot).

3. При первом запросе Firefox/WebKit — Playwright автоматически скачает нужный engine.

4. Предупреждение при первом вызове не-chromium: `"Note: First launch of Firefox/WebKit may take a minute to download the browser engine."`

---

### Этап 21: Component-level Regression

Новый тул `component_check`.

**MCP tool:**

```typescript
server.tool(
  "component_check",
  "Find all components on a page (by data-testid or custom selector) and screenshot each. Compare with baselines to find which specific components changed.",
  {
    action: { type: "string", enum: ["save_baseline", "compare", "list"], description: "save_baseline saves each component, compare diffs each, list shows found components." },
    url: { type: "string" },
    component_selector: { type: "string", description: "Selector to find components. Default: '[data-testid]'." },
    viewport: { type: "string", enum: ["mobile", "tablet", "desktop", "wide"] },
    name: { type: "string", description: "Baseline group name. Default: auto-generated from URL." }
  },
  handler
);
```

**Логика `list`:**

```typescript
const components = await page.evaluate((selector) => {
  return [...document.querySelectorAll(selector)].map(el => ({
    selector: el.getAttribute('data-testid') ? `[data-testid="${el.getAttribute('data-testid')}"]` : null,
    tag: el.tagName.toLowerCase(),
    bounds: el.getBoundingClientRect(),
    text: el.textContent?.slice(0, 60)
  })).filter(c => c.selector);
}, input.component_selector || '[data-testid]');
```

**Логика `save_baseline`:**
- Находим все компоненты.
- `element.screenshot()` для каждого.
- Сохраняем в BaselineStore с именами `{group}-{component-selector}`.

**Логика `compare`:**
- Находим компоненты.
- Для каждого: загружаем baseline, делаем скриншот, pixelmatch.
- Отчёт:

```
Component check: 8 components found, 2 changed

✓ [data-testid="header"]      — no changes
✓ [data-testid="nav"]         — no changes
✗ [data-testid="hero"]        — 12.3% pixels changed
✗ [data-testid="pricing-card"] — 8.7% pixels changed
✓ [data-testid="features"]    — no changes
✓ [data-testid="testimonials"] — no changes
✓ [data-testid="cta"]         — no changes
✓ [data-testid="footer"]      — no changes
```

Плюс diff images только для изменённых компонентов.

---

### Этап 22: CI/CD режим

#### src/cli/ci.ts

Отдельный entry point, не MCP — обычный CLI.

```bash
npx glimpse-mcp ci \
  --url http://localhost:3000 \
  --baseline ./snapshots \
  --viewports mobile,desktop \
  --fail-on-diff 5 \
  --checks screenshot,accessibility \
  --pages /,/about,/pricing
```

**Параметры CLI:**

```typescript
interface CIOptions {
  url: string;                    // URL dev сервера
  baseline: string;               // Путь к папке baselines
  viewports: ViewportName[];      // Viewport'ы для проверки
  failOnDiff: number;             // Порог % — если diff больше, exit code 1
  checks: ('screenshot' | 'accessibility' | 'console')[];
  pages: string[];                // Страницы для проверки
  updateBaseline: boolean;        // Обновить baselines вместо сравнения
  output: string;                 // Путь для отчёта. Default: '.glimpse/ci-report'
}
```

**Логика:**

1. Парсим CLI аргументы (простым разбором `process.argv`, без библиотеки).
2. Если `--update-baseline`:
   - Для каждой страницы и viewport — делаем скриншот, сохраняем в `--baseline` папку.
   - Exit 0.
3. Иначе (сравнение):
   - Для каждой страницы и viewport — делаем скриншот, сравниваем с baseline из папки.
   - Если checks включает accessibility — запускаем axe-core.
   - Если checks включает console — собираем ошибки.
   - Генерируем отчёт (HTML файл + JSON).
   - Если любой diff > `failOnDiff` или есть critical accessibility issues → exit 1.
   - Иначе → exit 0.

**HTML отчёт:** простой HTML с inline CSS, показывающий baseline / current / diff для каждой страницы.

**Для GitHub Actions:** exit code 1 автоматически провалит step. Комментарий к PR — через GitHub API (опционально, если передан `GITHUB_TOKEN`):

```bash
npx glimpse-mcp ci --url ... --github-comment
```

#### package.json

Добавляем второй бинарник:
```json
"bin": {
  "glimpse-mcp": "./dist/index.js",
  "glimpse-ci": "./dist/cli/ci.js"
}
```

---

### Этап 23: MCP Server

#### src/server.ts

Регистрируем все тулы. Полный список:

| # | Tool | Этап |
|---|------|------|
| 1 | `screenshot` | 5 |
| 2 | `screenshot_all` | 6 |
| 3 | `page_outline` | 7 |
| 4 | `console_logs` | 8 |
| 5 | `dom_inspect` | 9 |
| 6 | `pixel_diff` | 11 |
| 7 | `smart_diff` | 12 |
| 8 | `interact` | 14 |
| 9 | `flow` | 15 |
| 10 | `sweep` | 16 |
| 11 | `accessibility` | 17 |
| 12 | `performance` | 18 |
| 13 | `component_check` | 21 |

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function createServer(config: GlimpseConfig): McpServer {
  const server = new McpServer({
    name: "glimpse-mcp",
    version: "1.0.0"
  });

  const browserManager = new BrowserManager({
    headless: true,
    browserType: config.browser || 'chromium'
  });

  const baselineStore = new BaselineStore(config);
  const hmrListener = createHMRListener();

  // Регистрируем все 13 тулов...
  // Каждый handler обёрнут в try/catch
  // При ошибке: { content: [{ type: "text", text: `Error: ${msg}` }], isError: true }

  // Graceful shutdown
  process.on('SIGINT', async () => { await browserManager.close(); process.exit(0); });
  process.on('SIGTERM', async () => { await browserManager.close(); process.exit(0); });

  return server;
}
```

---

### Этап 24: CLI Entry Point

#### src/index.ts

```typescript
#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Glimpse MCP server started');
  if (config.port) console.error(`  Configured port: ${config.port}`);
  if (config.browser && config.browser !== 'chromium') console.error(`  Browser: ${config.browser}`);
}

main().catch((error) => {
  console.error('Failed to start Glimpse:', error);
  process.exit(1);
});
```

Вся диагностика → stderr. stdout → только MCP JSON-RPC.

---

### Этап 25: AGENT_GUIDE.md

```markdown
# Glimpse — Visual Feedback for AI Agents

You have access to Glimpse MCP tools that let you SEE and INTERACT with the frontend.

## Quick Reference

### Looking
| Tool | Use for |
|------|---------|
| `page_outline()` | See page structure: sections, headings, links. Start here on new pages. |
| `screenshot()` | See what the page looks like |
| `screenshot({ selector: ".hero" })` | See a specific section |
| `screenshot_all()` | Check responsive: mobile + tablet + desktop |
| `dom_inspect({ selector: ".card" })` | Get element's CSS, size, position |
| `console_logs()` | Check for JS errors |

### Comparing
| Tool | Use for |
|------|---------|
| `smart_diff({ action: "save_baseline" })` | Save current state (BEFORE changes) |
| `smart_diff({ action: "compare" })` | See what changed (AFTER changes) |
| `pixel_diff(...)` | Simple pixel comparison (smart_diff is usually better) |
| `component_check({ action: "compare" })` | Check which components changed |

### Interacting
| Tool | Use for |
|------|---------|
| `interact({ action: "click", selector: ".btn" })` | Click an element |
| `interact({ action: "type", selector: "#email", text: "..." })` | Type in a field |
| `interact({ action: "scroll", direction: "down" })` | Scroll the page |
| `interact({ action: "hover", selector: ".menu" })` | Hover for tooltip/dropdown |
| `flow({ steps: [...] })` | Run a multi-step user journey |

### Auditing
| Tool | Use for |
|------|---------|
| `accessibility()` | WCAG audit: contrast, alt text, ARIA |
| `performance()` | Web Vitals: LCP, FCP, CLS, resource sizes |
| `sweep({ urls: ["/", "/about", "/pricing"] })` | Scan multiple pages at once |

## Recommended Workflow

### Changing UI
1. `page_outline()` — understand the page
2. `screenshot({ selector: ".section-to-change" })` — see current state
3. `smart_diff({ action: "save_baseline" })` — save before
4. Make your code changes
5. `smart_diff({ action: "compare" })` — see what changed
6. Iterate until correct
7. `screenshot_all()` — verify responsive
8. `console_logs({ type: "error" })` — check for errors
9. `accessibility()` — check a11y

### Testing a User Flow
1. Use `flow()` with steps: navigate → type → click → wait → screenshot
2. Each step returns a screenshot so you can verify visually

### Debugging
1. `console_logs({ type: "error" })` — find errors
2. `dom_inspect({ selector: ".broken-element" })` — check styles
3. `screenshot({ selector: ".broken-element" })` — see it visually

## Tips
- No need to pass `url` — Glimpse auto-detects your dev server
- Use `selector` to focus on specific sections (better quality than full page)
- `smart_diff` > `pixel_diff` — it tells you WHAT changed, not just WHERE
- After any `interact` action, you get a screenshot automatically
- For long pages: `page_outline()` first, then screenshot sections individually
```

---

### Этап 26: README.md + финальные тесты

#### README.md

```markdown
# Glimpse

MCP server that gives AI coding agents visual feedback on frontend.
Screenshots, diffs, DOM inspection, interactions, accessibility, performance — all through MCP.

## Quick Start

\`\`\`bash
npx glimpse-mcp
\`\`\`

### Claude Code
\`\`\`bash
claude mcp add glimpse -- npx glimpse-mcp
\`\`\`

### Cursor
Add to `.cursor/mcp.json`:
\`\`\`json
{
  "mcpServers": {
    "glimpse": {
      "command": "npx",
      "args": ["glimpse-mcp"]
    }
  }
}
\`\`\`

## Tools (13)

| Tool | Description |
|------|-------------|
| `screenshot` | Screenshot a page or element |
| `screenshot_all` | Multi-viewport screenshots |
| `page_outline` | Page structure map |
| `pixel_diff` | Pixel-level before/after comparison |
| `smart_diff` | Structural DOM + pixel diff |
| `dom_inspect` | Element styles, size, position |
| `console_logs` | Browser console output |
| `interact` | Click, type, scroll, hover, select |
| `flow` | Multi-step user flow testing |
| `sweep` | Multi-page scanning |
| `accessibility` | WCAG accessibility audit (axe-core) |
| `performance` | Web Vitals + resource analysis |
| `component_check` | Per-component regression testing |

## Configuration

Create `.glimpserc.json` in your project root:

\`\`\`json
{
  "port": 3000,
  "viewports": ["mobile", "desktop"],
  "baselineDir": ".glimpse/baselines",
  "diffThreshold": 0.1,
  "ignoreSelectors": [".cookie-banner"],
  "browser": "chromium",
  "auth": {
    "cookies": [{ "name": "session", "value": "abc123", "domain": "localhost" }]
  }
}
\`\`\`

## CI/CD

\`\`\`bash
npx glimpse-ci \\
  --url http://localhost:3000 \\
  --baseline ./snapshots \\
  --viewports mobile,desktop \\
  --fail-on-diff 5 \\
  --pages /,/about,/pricing
\`\`\`

## Requirements

- Node.js >= 18
- A running dev server on localhost

## How It Works

Glimpse runs headless browsers via Playwright. AI agents call MCP tools,
Glimpse opens your localhost page, performs actions, and returns results.
Auto-detects dev server. Supports Chromium, Firefox, and WebKit.

## License

MIT
```

#### Тесты

**fixtures/test-page.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .header { background: #2563eb; color: white; padding: 20px; }
    .card { width: 300px; padding: 16px; margin: 20px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .card-title { font-size: 18px; font-weight: bold; }
    .low-contrast { color: #cccccc; background: #ffffff; }
    .hidden { display: none; }
    nav a { margin: 0 10px; color: white; }
  </style>
</head>
<body>
  <header data-testid="header">
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/pricing">Pricing</a>
    </nav>
    <h1>Test Page</h1>
  </header>
  <section class="hero" data-testid="hero">
    <h2>Welcome to Test</h2>
    <p>Hero content here.</p>
  </section>
  <section class="features" data-testid="features">
    <h2>Features</h2>
    <div class="card" data-testid="card">
      <div class="card-title">Card Title</div>
      <p>Card content.</p>
    </div>
  </section>
  <section class="a11y-test">
    <button class="icon-btn"></button>  <!-- Missing button text -->
    <img src="photo.jpg">              <!-- Missing alt -->
    <p class="low-contrast">Hard to read</p>
  </section>
  <footer data-testid="footer">
    <a href="/privacy">Privacy</a>
  </footer>
  <script>
    console.log("Page loaded");
    console.warn("Test warning");
  </script>
</body>
</html>
```

**fixtures/test-form.html:**
```html
<!DOCTYPE html>
<html>
<body>
  <form id="login">
    <input type="email" id="email" placeholder="Email">
    <input type="password" id="password" placeholder="Password">
    <select id="role">
      <option value="user">User</option>
      <option value="admin">Admin</option>
    </select>
    <button type="submit" id="submit">Login</button>
  </form>
  <div id="result" style="display:none">Logged in!</div>
  <script>
    document.getElementById('login').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('result').style.display = 'block';
    });
  </script>
</body>
</html>
```

**Тест-кейсы (минимум):**

| # | Тест | Что проверяем |
|---|------|---------------|
| 1 | screenshot returns PNG | Buffer не пустой, начинается с PNG header |
| 2 | screenshot with selector | Размер меньше full page |
| 3 | screenshot invalid selector | Возвращает isError: true |
| 4 | screenshot_all | 3 картинки, разные размеры |
| 5 | page_outline | Содержит header, hero, features, footer секции |
| 6 | page_outline headings | h1, h2 в правильном порядке |
| 7 | page_outline links | /, /about, /pricing из nav |
| 8 | console_logs | "Page loaded" и "Test warning" |
| 9 | console_logs filter | type=warning → только warning |
| 10 | dom_inspect | .card → width=300, padding=16 |
| 11 | pixel_diff no changes | save + compare → 0% |
| 12 | smart_diff no changes | save + compare → 0 changes |
| 13 | interact click | click #submit → #result becomes visible |
| 14 | interact type | type in #email → value appears |
| 15 | interact select | select #role → "admin" selected |
| 16 | flow multi-step | type email → type password → click submit → result visible |
| 17 | accessibility | Находит missing button text и missing alt |
| 18 | performance | FCP и LCP возвращаются как числа > 0 |
| 19 | port_discovery | Находит тестовый сервер |
| 20 | config loads | Парсит .glimpserc.json с кастомными значениями |

---

## 4. Обработка граничных случаев

### Страница не загружается
`page.goto()` таймаут 15 секунд → `"Page failed to load: timeout after 15s. Is your dev server running?"`

### Элемент не найден
`page.waitForSelector()` таймаут 5 секунд → `"Element not found: ${selector}. Check selector and ensure element is rendered."`

### Анимации
Инжектим CSS отключающий анимации и transitions при каждой загрузке страницы (в BrowserManager).

### Большие страницы
`full_page: true` → ограничение maxPageHeight (default 10000px). Warning если обрезано.

### Параллельные запросы
Mutex в BrowserManager → все запросы выполняются последовательно.

### Playwright не установлен
При первом запуске Playwright скачивает browser. Если ошибка → понятное сообщение с инструкцией.

### HMR не работает
Fallback на обычный reload. Не блокируем агента.

### Auth expired
Если страница возвращает 401/403 после применения auth → сообщаем агенту: `"Page returned 401. Auth may be expired. Update auth in .glimpserc.json."`

---

## 5. Критерии готовности

1. ✅ `npx glimpse-mcp` стартует без ошибок
2. ✅ Автообнаружение dev сервера
3. ✅ `.glimpserc.json` загружается
4. ✅ HMR detection работает с Vite и Webpack
5. ✅ Все 13 тулов работают через MCP
6. ✅ Baselines persist между сессиями
7. ✅ Multi-browser: Chromium + Firefox + WebKit
8. ✅ Auth support: cookies + localStorage + headers
9. ✅ CI режим: `npx glimpse-ci` с exit codes
10. ✅ Все 20 тестов проходят
11. ✅ README.md + AGENT_GUIDE.md
12. ✅ npm publish работает