import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AddressInfo } from 'net';
import { BrowserManager } from '../src/browser.js';

const testPageHtml = readFileSync(
  join(import.meta.dirname, 'fixtures', 'test-page.html'),
  'utf-8'
);

export function startTestServer(): Promise<{ url: string; port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(testPageHtml);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        port: addr.port,
        close: () => server.close(),
      });
    });
  });
}

export function createBrowserManager(): BrowserManager {
  return new BrowserManager();
}
