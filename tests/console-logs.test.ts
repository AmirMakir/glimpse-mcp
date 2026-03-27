import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, createBrowserManager } from './helpers.js';
import { handleConsoleLogs } from '../src/tools/console-logs.js';
import { BrowserManager } from '../src/browser.js';
import { resolveViewport } from '../src/utils.js';

let server: { url: string; port: number; close: () => void };
let browser: BrowserManager;

beforeAll(async () => {
  server = await startTestServer();
  browser = createBrowserManager();
  // Open the page to start capturing console logs
  await browser.getPage(server.url, resolveViewport());
  // Wait a moment for console messages to be captured
  await new Promise((resolve) => setTimeout(resolve, 500));
});

afterAll(async () => {
  await browser.close();
  server.close();
});

describe('console_logs', () => {
  it('captures "Page loaded" and "Test warning"', async () => {
    const result = await handleConsoleLogs(browser, {});
    const text = result.content[0].text;
    expect(text).toContain('Page loaded');
    expect(text).toContain('Test warning');
  });

  it('filters by type warning', async () => {
    const result = await handleConsoleLogs(browser, { type: 'warning' });
    const text = result.content[0].text;
    expect(text).toContain('Test warning');
    expect(text).not.toContain('Page loaded');
  });
});
