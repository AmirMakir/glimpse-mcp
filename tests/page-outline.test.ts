import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, createBrowserManager } from './helpers.js';
import { handlePageOutline } from '../src/tools/page-outline.js';
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

describe('page_outline', () => {
  it('returns sections in correct order (by y)', async () => {
    const result = await handlePageOutline(browser, { url: server.url });
    const text = result.content[0].text;

    // header should come before hero, hero before features, features before footer
    const headerIdx = text.indexOf('header');
    const heroIdx = text.indexOf('hero');
    const featuresIdx = text.indexOf('features');
    const footerIdx = text.indexOf('footer');

    expect(headerIdx).toBeLessThan(heroIdx);
    expect(heroIdx).toBeLessThan(featuresIdx);
    expect(featuresIdx).toBeLessThan(footerIdx);
  });

  it('returns headings with levels', async () => {
    const result = await handlePageOutline(browser, { url: server.url });
    const text = result.content[0].text;

    expect(text).toContain('h1');
    expect(text).toContain('Test Page');
    expect(text).toContain('h2');
    expect(text).toContain('Welcome to the Hero');
    expect(text).toContain('Features');
  });

  it('returns nav links with href', async () => {
    const result = await handlePageOutline(browser, { url: server.url });
    const text = result.content[0].text;

    expect(text).toContain('Home');
    expect(text).toContain('/about');
    expect(text).toContain('/contact');
    expect(text).toContain('/privacy');
  });

  it('returns only text content, no images', async () => {
    const result = await handlePageOutline(browser, { url: server.url });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });
});
