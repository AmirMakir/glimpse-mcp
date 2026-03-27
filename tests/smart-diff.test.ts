import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, createBrowserManager } from './helpers.js';
import { handleSmartDiff } from '../src/tools/smart-diff.js';
import { BrowserManager } from '../src/browser.js';
import { BaselineStore } from '../src/baseline-store.js';
import { join } from 'path';
import { tmpdir } from 'os';

let server: { url: string; port: number; close: () => void };
let browser: BrowserManager;
let store: BaselineStore;

beforeAll(async () => {
  server = await startTestServer();
  browser = createBrowserManager();
  store = new BaselineStore(join(tmpdir(), `glimpse-test-smart-${Date.now()}`));
});

afterAll(async () => {
  await browser.close();
  server.close();
});

describe('smart_diff', () => {
  it('save_baseline + compare without changes returns 0 changes', async () => {
    const name = 'smart-test';

    // Save baseline
    const saveResult = await handleSmartDiff(browser, {
      action: 'save_baseline',
      url: server.url,
      name,
    }, store);
    expect(saveResult.content[1].text).toContain('Smart baseline saved');

    // Compare (no changes)
    const compareResult = await handleSmartDiff(browser, {
      action: 'compare',
      url: server.url,
      name,
    }, store);
    expect(compareResult.content[0].text).toContain('0 changes detected');
  });
});
