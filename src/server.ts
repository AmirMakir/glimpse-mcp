import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { BrowserManager } from './browser.js';
import { BaselineStore } from './baseline-store.js';
import { GlimpseConfig } from './config.js';
import { DESIGN_GUIDE } from './resources/design-guide.js';
import { handleScreenshot } from './tools/screenshot.js';
import { handleScreenshotAll } from './tools/screenshot-all.js';
import { handlePixelDiff } from './tools/pixel-diff.js';
import { handleSmartDiff } from './tools/smart-diff.js';
import { handleDomInspect } from './tools/dom-inspect.js';
import { handleConsoleLogs } from './tools/console-logs.js';
import { handlePageOutline } from './tools/page-outline.js';
import { handleInteract } from './tools/interact.js';
import { handleFlow } from './tools/flow.js';
import { handleSweep } from './tools/sweep.js';
import { handleAccessibility } from './tools/accessibility.js';

const SERVER_INSTRUCTIONS = `You can SEE the frontend. BEFORE editing any frontend code, you MUST:
1. screenshot({ selector }) — see the section you will change
2. smart_diff({ action: "save_baseline" }) — save state before editing

AFTER editing code, you MUST:
3. smart_diff({ action: "compare" }) — verify your changes
4. console_logs({ type: "error" }) — check for JS errors
5. screenshot({ selector, viewport: "mobile" }) — check mobile if layout changed

Use interact({ action: "hover" }) to verify hover/click states. Use dom_inspect() to read current CSS before changing it.`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapHandler<T>(fn: (input: T) => Promise<any>) {
  return async (input: T) => {
    try {
      return await fn(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
    }
  };
}

export function createServer(config?: GlimpseConfig): McpServer {
  const server = new McpServer({
    name: 'glimpse-mcp',
    version: '0.1.0',
  }, {
    instructions: SERVER_INSTRUCTIONS,
  });

  const browserManager = new BrowserManager();
  const baselineStore = new BaselineStore(config?.baselineDir ?? '.glimpse/baselines');

  // Design skill resource
  server.resource(
    'design-system',
    'glimpse://design-system',
    { description: 'How to work with frontend using Glimpse visual tools — workflows, patterns, selector strategy, tips' },
    () => ({
      contents: [{
        uri: 'glimpse://design-system',
        text: DESIGN_GUIDE,
        mimeType: 'text/markdown',
      }]
    })
  );

  // 1. screenshot
  server.tool(
    'screenshot',
    'Take a screenshot of a web page or a specific element. Returns the image. Use this to see what the UI looks like.',
    {
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector to screenshot a specific element.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport size. Default: desktop.'),
      full_page: z.boolean().optional().describe('Capture full scrollable page. Default: false.'),
      reload: z.boolean().optional().describe('Force page reload. Default: true on first call.'),
    },
    wrapHandler((input) => handleScreenshot(browserManager, input))
  );

  // 2. screenshot_all
  server.tool(
    'screenshot_all',
    'Take screenshots at multiple viewports in one call (mobile + tablet + desktop). Use this to check responsive design.',
    {
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector to screenshot a specific element.'),
      full_page: z.boolean().optional().describe('Capture full scrollable page. Default: false.'),
      viewports: z.array(z.enum(['mobile', 'tablet', 'desktop', 'wide'])).optional().describe("Viewports to capture. Default: ['mobile', 'tablet', 'desktop']."),
    },
    wrapHandler((input) => handleScreenshotAll(browserManager, input))
  );

  // 3. pixel_diff
  server.tool(
    'pixel_diff',
    "Compare screenshots pixel-by-pixel. First call with action 'save_baseline' to save current state, then make changes, then call with action 'compare' to see what changed. Returns diff image with changed pixels highlighted in red.",
    {
      action: z.enum(['save_baseline', 'compare']).describe("save_baseline to save current state, compare to diff against saved baseline."),
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector for element-level diff.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport. Default: desktop.'),
      name: z.string().optional().describe('Baseline name for multiple baselines. Default: auto-generated.'),
    },
    wrapHandler((input) => handlePixelDiff(browserManager, input, baselineStore))
  );

  // 4. smart_diff
  server.tool(
    'smart_diff',
    "Compare before/after with both pixel diff AND DOM analysis. Returns structured changes: which elements moved, resized, changed styles. Much more useful than pixel_diff alone. First call with action 'save_baseline', then make changes, then call with action 'compare'.",
    {
      action: z.enum(['save_baseline', 'compare']).describe("save_baseline to save current state, compare to diff against saved baseline."),
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector to scope diff to a section.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport. Default: desktop.'),
      name: z.string().optional().describe('Baseline name. Default: auto-generated.'),
    },
    wrapHandler((input) => handleSmartDiff(browserManager, input, baselineStore))
  );

  // 5. dom_inspect
  server.tool(
    'dom_inspect',
    'Inspect a DOM element: bounding box, computed CSS styles, attributes, text content, children count. Use this to understand element structure before making changes.',
    {
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().describe('CSS selector of element to inspect. Required.'),
      reload: z.boolean().optional().describe('Force page reload. Default: true on first call.'),
    },
    wrapHandler((input) => handleDomInspect(browserManager, input))
  );

  // 6. console_logs
  server.tool(
    'console_logs',
    'Get browser console output: logs, warnings, errors, uncaught exceptions. Use this to check for JS errors after making changes.',
    {
      url: z.string().optional().describe('Page URL. Opens page to start collecting if not open yet.'),
      type: z.enum(['all', 'error', 'warning', 'log', 'info']).optional().describe('Filter by type. Default: all.'),
      clear: z.boolean().optional().describe('Clear log after reading. Default: false.'),
    },
    wrapHandler((input) => handleConsoleLogs(browserManager, input))
  );

  // 7. page_outline
  server.tool(
    'page_outline',
    'Get page structure: all sections, landmarks, headings, and nav links with positions and sizes. Use this FIRST on unfamiliar or long pages before screenshotting specific sections.',
    {
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport. Default: desktop.'),
      reload: z.boolean().optional().describe('Force reload. Default: true on first call.'),
    },
    wrapHandler((input) => handlePageOutline(browserManager, input))
  );

  // 8. interact
  server.tool(
    'interact',
    'Interact with the page: click, type, scroll, hover, select, press_key. Returns a screenshot after the action. Use to test user flows and UI states.',
    {
      action: z.enum(['click', 'type', 'scroll', 'hover', 'select', 'press_key']).describe('Action to perform.'),
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector of target element. Required for click, type, hover, select.'),
      text: z.string().optional().describe("Text to type (for 'type') or key to press (for 'press_key')."),
      value: z.string().optional().describe("Value to select (for 'select' action in dropdowns)."),
      direction: z.enum(['up', 'down', 'left', 'right']).optional().describe("Scroll direction. Default: down."),
      amount: z.number().optional().describe('Scroll amount in pixels. Default: 500.'),
      screenshot: z.boolean().optional().describe('Return screenshot after action. Default: true.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport size. Default: desktop.'),
      wait: z.number().optional().describe('Ms to wait after action before screenshot. Default: 500. Increase for slow animations.'),
    },
    wrapHandler((input) => handleInteract(browserManager, input))
  );

  // 9. flow
  server.tool(
    'flow',
    'Execute a multi-step user flow: navigate, click, type, scroll, hover, select, press_key, wait, screenshot. Returns screenshots after each step. Use to test complete user journeys like login, checkout, form submission.',
    {
      steps: z.array(z.object({
        action: z.enum(['navigate', 'click', 'type', 'scroll', 'hover', 'select', 'press_key', 'wait', 'screenshot']).describe('Action to perform.'),
        url: z.string().optional().describe('URL for navigate action.'),
        selector: z.string().optional().describe('CSS selector for click/type/hover/select/wait.'),
        text: z.string().optional().describe('Text for type, key for press_key.'),
        value: z.string().optional().describe('Value for select.'),
        direction: z.enum(['up', 'down', 'left', 'right']).optional(),
        amount: z.number().optional(),
        timeout: z.number().optional().describe('Timeout in ms for wait action. Default: 5000.'),
      })).describe('Array of steps to execute sequentially.'),
      screenshot_each: z.boolean().optional().describe('Take screenshot after every step. Default: true.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional(),
      url: z.string().optional().describe('Starting URL if first step is not navigate.'),
    },
    wrapHandler((input) => handleFlow(browserManager, input))
  );

  // 10. sweep
  server.tool(
    'sweep',
    'Scan multiple pages: take screenshots and collect console errors on each. Returns a consolidated report. Use after changing shared components to check nothing broke.',
    {
      urls: z.array(z.string()).describe("Array of URLs or paths to check. Paths like '/about' are resolved against the detected dev server."),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional().describe('Viewport. Default: desktop.'),
      checks: z.array(z.enum(['screenshot', 'console'])).optional().describe("What to check on each page. Default: ['screenshot', 'console']."),
    },
    wrapHandler((input) => handleSweep(browserManager, input))
  );

  // 11. accessibility
  server.tool(
    'accessibility',
    'Run WCAG accessibility audit using axe-core. Finds missing alt text, low contrast, missing button labels, heading order issues. Returns severity, affected elements, and fix suggestions.',
    {
      url: z.string().optional().describe('Page URL. Auto-detected if omitted.'),
      selector: z.string().optional().describe('CSS selector to scope audit to a section.'),
      viewport: z.enum(['mobile', 'tablet', 'desktop', 'wide']).optional(),
      tags: z.array(z.string()).optional().describe("WCAG tags to check. Default: ['wcag2a', 'wcag2aa']. Options: wcag2a, wcag2aa, wcag2aaa, best-practice."),
    },
    wrapHandler((input) => handleAccessibility(browserManager, input))
  );

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await browserManager.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await browserManager.close();
    process.exit(0);
  });

  return server;
}
