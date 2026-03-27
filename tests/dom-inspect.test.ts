import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, createBrowserManager } from './helpers.js';
import { handleDomInspect } from '../src/tools/dom-inspect.js';
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

describe('dom_inspect', () => {
  it('returns correct styles for .card element', async () => {
    const result = await handleDomInspect(browser, { url: server.url, selector: '.card' });
    const text = result.content[0].text;
    expect(text).toContain('width');
    expect(text).toContain('400');
    expect(text).toContain('padding');
    expect(text).toContain('16px');
    expect(text).toContain('Card Title');
  });
});
