import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AddressInfo } from 'net';
import { BrowserManager } from '../src/browser.js';
import { handleInteract } from '../src/tools/interact.js';
import { resetCache } from '../src/port-discovery.js';

const formHtml = readFileSync(join(import.meta.dirname, 'fixtures', 'test-form.html'), 'utf-8');

describe('interact', () => {
  let url: string;
  let server: ReturnType<typeof createServer>;
  let bm: BrowserManager;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(formHtml);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    url = `http://127.0.0.1:${addr.port}`;
    bm = new BrowserManager();
    resetCache();
  });

  afterAll(async () => {
    await bm.close();
    server.close();
  });

  it('types text into an input field', async () => {
    const result = await handleInteract(bm, {
      action: 'type',
      url,
      selector: '#email',
      text: 'test@example.com',
      screenshot: false,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Typed');
  });

  it('clicks a button and returns a screenshot', async () => {
    // First fill the form
    await handleInteract(bm, { action: 'type', url, selector: '#email', text: 'a@b.com', screenshot: false });
    await handleInteract(bm, { action: 'type', url, selector: '#password', text: 'pass', screenshot: false });

    const result = await handleInteract(bm, {
      action: 'click',
      url,
      selector: '#submit',
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Clicked');
    // Should have screenshot
    expect(result.content.length).toBeGreaterThanOrEqual(2);
    expect(result.content[1].type).toBe('image');
  });

  it('selects an option from a dropdown', async () => {
    const result = await handleInteract(bm, {
      action: 'select',
      url,
      selector: '#role',
      value: 'admin',
      screenshot: false,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('Selected');
  });

  it('returns error when selector is missing for click', async () => {
    const result = await handleInteract(bm, {
      action: 'click',
      url,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('selector is required');
  });
});
