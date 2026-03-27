import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, createBrowserManager } from './helpers.js';
import { handleScreenshot } from '../src/tools/screenshot.js';
import { handleScreenshotAll } from '../src/tools/screenshot-all.js';
import { BrowserManager } from '../src/browser.js';

let server: { url: string; port: number; close: () => void };
let browser: BrowserManager;

beforeAll(async () => {
  server = await startTestServer();
  browser = createBrowserManager();
});

afterAll(async () => {
  await browser.close();
  server.close();
});

describe('screenshot', () => {
  it('returns non-empty PNG buffer', async () => {
    const result = await handleScreenshot(browser, { url: server.url });
    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('image');
    expect(result.content[0].data).toBeTruthy();
    expect(result.content[0].data!.length).toBeGreaterThan(0);
  });

  it('screenshots a specific element with selector', async () => {
    const fullResult = await handleScreenshot(browser, { url: server.url });
    const selectorResult = await handleScreenshot(browser, { url: server.url, selector: '.card' });

    const fullSize = fullResult.content[0].data!.length;
    const selectorSize = selectorResult.content[0].data!.length;
    expect(selectorSize).toBeLessThan(fullSize);
  });

  it('returns error for non-existent selector', async () => {
    await expect(
      handleScreenshot(browser, { url: server.url, selector: '.nonexistent' })
    ).rejects.toThrow();
  }, 10000);
});

describe('screenshot_all', () => {
  it('returns 3 images for default viewports', async () => {
    const result = await handleScreenshotAll(browser, { url: server.url });
    const images = result.content.filter((c) => c.type === 'image');
    expect(images).toHaveLength(3);
  });
});
