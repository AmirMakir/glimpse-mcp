export interface DiscoveryResult {
  url: string;
  port: number;
}

let cached: DiscoveryResult | null = null;

const SCAN_PORTS = [5173, 5174, 3000, 3001, 8080, 8081, 4200, 4321, 8000];

export async function resolveUrl(url?: string): Promise<DiscoveryResult> {
  if (url && url.trim() !== '') {
    try {
      const parsed = new URL(url);
      return { url, port: parseInt(parsed.port, 10) || (parsed.protocol === 'https:' ? 443 : 80) };
    } catch {
      return { url, port: 0 };
    }
  }

  if (cached) {
    return cached;
  }

  for (const port of SCAN_PORTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      await fetch(`http://localhost:${port}`, { signal: controller.signal });
      clearTimeout(timeout);

      cached = { url: `http://localhost:${port}`, port };
      return cached;
    } catch {
      // Port not responding, try next
    }
  }

  throw new Error(
    'No dev server found. Start your dev server or pass url parameter.'
  );
}

/** Reset cache — used for testing */
export function resetCache(): void {
  cached = null;
}
