import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from '../src/config.js';

function makeTempDir(): string {
  const dir = join(tmpdir(), `glimpse-config-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('loadConfig', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      try { unlinkSync(join(dir, '.glimpserc.json')); } catch {}
    }
    dirs.length = 0;
  });

  it('returns defaults when no config file exists', () => {
    const dir = makeTempDir();
    dirs.push(dir);
    const config = loadConfig(dir);
    expect(config.diffThreshold).toBe(0.1);
    expect(config.baselineDir).toBe('.glimpse/baselines');
    expect(config.browser).toBe('chromium');
    expect(config.maxPageHeight).toBe(10000);
    expect(config.waitAfterNavigation).toBe(200);
    expect(config.viewports).toEqual(['mobile', 'tablet', 'desktop']);
  });

  it('loads custom values from .glimpserc.json', () => {
    const dir = makeTempDir();
    dirs.push(dir);
    writeFileSync(join(dir, '.glimpserc.json'), JSON.stringify({
      port: 3000,
      diffThreshold: 0.2,
      baselineDir: 'custom/baselines',
      ignoreSelectors: ['.cookie-banner'],
    }));

    const config = loadConfig(dir);
    expect(config.port).toBe(3000);
    expect(config.diffThreshold).toBe(0.2);
    expect(config.baselineDir).toBe('custom/baselines');
    expect(config.ignoreSelectors).toEqual(['.cookie-banner']);
    // defaults preserved
    expect(config.browser).toBe('chromium');
  });

  it('returns defaults on invalid JSON', () => {
    const dir = makeTempDir();
    dirs.push(dir);
    writeFileSync(join(dir, '.glimpserc.json'), 'not json!!!');

    const config = loadConfig(dir);
    expect(config.diffThreshold).toBe(0.1);
  });
});
