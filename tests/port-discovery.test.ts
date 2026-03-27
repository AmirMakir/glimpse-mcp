import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer } from './helpers.js';
import { resolveUrl, resetCache } from '../src/port-discovery.js';

let server: { url: string; port: number; close: () => void };

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  resetCache();
});

describe('port-discovery', () => {
  it('returns provided URL as-is', async () => {
    const result = await resolveUrl('http://example.com:3000');
    expect(result.url).toBe('http://example.com:3000');
    expect(result.port).toBe(3000);
  });

  it('finds a running test server by explicit URL', async () => {
    const result = await resolveUrl(server.url);
    expect(result.url).toBe(server.url);
  });
});
