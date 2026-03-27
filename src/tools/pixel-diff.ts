import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';
import { BaselineStore, generateBaselineName, loadBaselineWithFallback } from '../baseline-store.js';

export interface PixelDiffInput {
  action: 'save_baseline' | 'compare';
  url?: string;
  selector?: string;
  viewport?: ViewportName;
  name?: string;
}

async function takeScreenshot(
  browserManager: BrowserManager,
  url: string,
  viewport: ViewportName | undefined,
  selector?: string,
  reload?: boolean
): Promise<Buffer> {
  const vp = resolveViewport(viewport);
  const page = await browserManager.getPage(url, vp, reload);

  if (selector) {
    const element = await page.waitForSelector(selector, { timeout: 5000 });
    if (!element) throw new Error(`Element not found: ${selector}`);
    return await element.screenshot({ type: 'png' });
  }

  return await page.screenshot({ type: 'png' });
}

export async function handlePixelDiff(
  browserManager: BrowserManager,
  input: PixelDiffInput,
  store?: BaselineStore,
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>; isError?: boolean }> {
  const { url } = await resolveUrl(input.url);
  const viewportName = input.viewport ?? 'desktop';
  const name = input.name ?? generateBaselineName(url, viewportName, input.selector);

  if (input.action === 'save_baseline') {
    const buffer = await takeScreenshot(browserManager, url, input.viewport, input.selector);

    if (store) {
      await store.save(name, {
        screenshot: buffer,
        timestamp: Date.now(),
        viewport: viewportName,
        url,
      });
    }

    const img = PNG.sync.read(buffer);
    return {
      content: [
        { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
        { type: 'text', text: `Baseline saved: '${name}'. ${img.width}x${img.height}px.` },
      ],
    };
  }

  // compare
  const baseline = store
    ? await loadBaselineWithFallback(store, name, url, viewportName, input.name, !!input.selector)
    : null;
  if (!baseline) {
    return {
      content: [{ type: 'text', text: `No baseline found: '${name}'. Call with action: 'save_baseline' first.` }],
      isError: true,
    };
  }

  const currentBuffer = await takeScreenshot(browserManager, url, input.viewport, input.selector, true);
  const img1 = PNG.sync.read(baseline.screenshot);
  const img2 = PNG.sync.read(currentBuffer);

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return {
      content: [
        { type: 'text', text: `Size changed: was ${img1.width}x${img1.height}, now ${img2.width}x${img2.height}` },
        { type: 'image', data: currentBuffer.toString('base64'), mimeType: 'image/png' },
      ],
    };
  }

  const diff = new PNG({ width: img1.width, height: img1.height });
  const numDiffPixels = pixelmatch(
    img1.data, img2.data, diff.data,
    img1.width, img1.height,
    { threshold: 0.1 }
  );

  const totalPixels = img1.width * img1.height;
  const diffPercent = ((numDiffPixels / totalPixels) * 100).toFixed(2);
  const diffBuffer = PNG.sync.write(diff);

  return {
    content: [
      { type: 'text', text: `Pixel diff result: ${diffPercent}% pixels changed (${numDiffPixels.toLocaleString()} of ${totalPixels.toLocaleString()}).` },
      { type: 'image', data: diffBuffer.toString('base64'), mimeType: 'image/png' },
      { type: 'text', text: '=== Current screenshot ===' },
      { type: 'image', data: currentBuffer.toString('base64'), mimeType: 'image/png' },
    ],
  };
}
