import { readFileSync } from 'fs';
import { join } from 'path';
import type { ViewportName } from './utils.js';

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface GlimpseConfig {
  port?: number;
  viewports?: ViewportName[];
  baselineDir?: string;
  diffThreshold?: number;
  ignoreSelectors?: string[];
  waitAfterNavigation?: number;
  maxPageHeight?: number;
  browser?: BrowserType;
}

const DEFAULTS: Required<Pick<GlimpseConfig, 'viewports' | 'baselineDir' | 'diffThreshold' | 'waitAfterNavigation' | 'maxPageHeight' | 'browser'>> = {
  viewports: ['mobile', 'tablet', 'desktop'],
  baselineDir: '.glimpse/baselines',
  diffThreshold: 0.1,
  waitAfterNavigation: 200,
  maxPageHeight: 10000,
  browser: 'chromium',
};

export function loadConfig(cwd?: string): GlimpseConfig {
  const dir = cwd ?? process.cwd();
  const filePath = join(dir, '.glimpserc.json');

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      ...DEFAULTS,
      ...pick(parsed, [
        'port', 'viewports', 'baselineDir', 'diffThreshold',
        'ignoreSelectors', 'waitAfterNavigation', 'maxPageHeight', 'browser',
      ]),
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return { ...DEFAULTS };
    }
    console.error(`Warning: Failed to parse .glimpserc.json: ${error.message}. Using defaults.`);
    return { ...DEFAULTS };
  }
}

function pick<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result as Partial<T>;
}
