import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import type { DOMSnapshot } from './snapshot.js';
import type { ViewportName } from './utils.js';

export interface Baseline {
  screenshot: Buffer;
  domSnapshot?: DOMSnapshot;
  timestamp: number;
  viewport: string;
  url: string;
}

interface BaselineMetadata {
  url: string;
  viewport: string;
  timestamp: number;
  domSnapshot?: DOMSnapshot;
}

const MAX_MEMORY_ENTRIES = 50;

export class BaselineStore {
  private memory = new Map<string, Baseline>();
  private diskDir: string;

  constructor(baselineDir: string = '.glimpse/baselines') {
    this.diskDir = baselineDir;
  }

  async save(name: string, baseline: Baseline): Promise<void> {
    this.memory.set(name, baseline);

    // Evict oldest entries if memory cache grows too large
    if (this.memory.size > MAX_MEMORY_ENTRIES) {
      const oldest = this.memory.keys().next().value!;
      this.memory.delete(oldest);
    }

    mkdirSync(this.diskDir, { recursive: true });

    const pngPath = join(this.diskDir, `${name}.png`);
    const jsonPath = join(this.diskDir, `${name}.json`);

    writeFileSync(pngPath, baseline.screenshot);

    const meta: BaselineMetadata = {
      url: baseline.url,
      viewport: baseline.viewport,
      timestamp: baseline.timestamp,
      domSnapshot: baseline.domSnapshot,
    };
    writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
  }

  async load(name: string): Promise<Baseline | null> {
    const cached = this.memory.get(name);
    if (cached) return cached;

    const pngPath = join(this.diskDir, `${name}.png`);
    const jsonPath = join(this.diskDir, `${name}.json`);

    if (!existsSync(pngPath) || !existsSync(jsonPath)) {
      return null;
    }

    try {
      const screenshot = readFileSync(pngPath);
      const meta: BaselineMetadata = JSON.parse(readFileSync(jsonPath, 'utf-8'));

      const baseline: Baseline = {
        screenshot,
        domSnapshot: meta.domSnapshot,
        timestamp: meta.timestamp,
        viewport: meta.viewport,
        url: meta.url,
      };

      this.memory.set(name, baseline);
      return baseline;
    } catch {
      return null;
    }
  }

  async list(): Promise<string[]> {
    if (!existsSync(this.diskDir)) return [];

    const files = readdirSync(this.diskDir);
    return files
      .filter(f => f.endsWith('.png'))
      .map(f => f.replace(/\.png$/, ''));
  }

  async delete(name: string): Promise<void> {
    this.memory.delete(name);

    const pngPath = join(this.diskDir, `${name}.png`);
    const jsonPath = join(this.diskDir, `${name}.json`);

    try { unlinkSync(pngPath); } catch {}
    try { unlinkSync(jsonPath); } catch {}
  }
}

/**
 * Load baseline by exact name, falling back to page-level baseline (without selector).
 * This handles the case where baseline was saved without selector but compare uses one.
 */
export async function loadBaselineWithFallback(
  store: BaselineStore,
  name: string,
  url: string,
  viewportName: string,
  inputName?: string,
  hasSelector?: boolean,
): Promise<Baseline | null> {
  let baseline = await store.load(name);
  if (!baseline && hasSelector) {
    const fallbackName = inputName ?? generateBaselineName(url, viewportName);
    baseline = await store.load(fallbackName);
  }
  return baseline;
}

export function generateBaselineName(url: string, viewport: string, selector?: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const pageName = path === '/' ? 'homepage' : path.replace(/^\/|\/$/g, '').replace(/\//g, '-');
    const selectorPart = selector ? `-${selector.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    return `${pageName}${selectorPart}-${viewport}`;
  } catch {
    const safeName = url.replace(/[^a-zA-Z0-9]/g, '-');
    const selectorPart = selector ? `-${selector.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    return `${safeName}${selectorPart}-${viewport}`;
  }
}
