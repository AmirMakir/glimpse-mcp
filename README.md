# Glimpse

MCP server that gives AI coding agents visual feedback on frontend.
Screenshots, diffs, DOM inspection, UI interaction, console logs — all through MCP.

## Quick Start

```bash
npx glimpse-mcp
```

### With Claude Code
```bash
claude mcp add glimpse -- npx glimpse-mcp
```

### With Cursor
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "glimpse": {
      "command": "npx",
      "args": ["glimpse-mcp"]
    }
  }
}
```

## Tools (11)

| Tool | Description |
|------|-------------|
| `page_outline` | Page structure: sections, headings, nav links |
| `screenshot` | Take a screenshot of a page or element |
| `screenshot_all` | Multi-viewport screenshots in one call |
| `pixel_diff` | Before/after pixel comparison |
| `smart_diff` | Structural DOM diff + pixel diff |
| `dom_inspect` | Inspect element styles, size, position |
| `console_logs` | Browser console output and errors |
| `interact` | Click, type, scroll, hover, select on page elements |
| `flow` | Multi-step user flow testing (login, checkout) |
| `sweep` | Scan multiple pages for errors |
| `accessibility` | WCAG accessibility audit via axe-core |

## Configuration

Create `.glimpserc.json` in your project root:

```json
{
  "port": 3000,
  "viewports": ["mobile", "desktop"],
  "baselineDir": ".glimpse/baselines",
  "diffThreshold": 0.1,
  "ignoreSelectors": [".cookie-banner"],
  "waitAfterNavigation": 200,
  "maxPageHeight": 10000,
  "browser": "chromium"
}
```

All fields are optional. Without this file, Glimpse uses sensible defaults.

| Option | Default | Description |
|--------|---------|-------------|
| `port` | auto-detect | Dev server port |
| `viewports` | `["mobile", "tablet", "desktop"]` | Default viewports for `screenshot_all` |
| `baselineDir` | `.glimpse/baselines` | Where to save baselines |
| `diffThreshold` | `0.1` | Pixelmatch threshold (0-1) |
| `ignoreSelectors` | `[]` | Elements to hide during diff |
| `waitAfterNavigation` | `200` | Extra ms to wait after navigation |
| `maxPageHeight` | `10000` | Max height for full-page screenshots |
| `browser` | `chromium` | Browser engine |

## How It Works

Glimpse runs headless Chromium via Playwright. When an AI agent calls a tool,
Glimpse opens your localhost page, performs the action, and returns results
through MCP protocol.

Auto-detects dev server on common ports (5173, 3000, 8080, etc).

Baselines are persisted to disk (`.glimpse/baselines/`) so they survive between sessions.

## Requirements

- Node.js >= 18
- A running dev server on localhost

## License

MIT
