import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';
import { captureSnapshot, DOMSnapshot } from '../snapshot.js';
import { compareDOMSnapshots, DOMChange } from '../diff-engine.js';
import { BaselineStore, generateBaselineName, loadBaselineWithFallback } from '../baseline-store.js';

export interface SmartDiffInput {
  action: 'save_baseline' | 'compare';
  url?: string;
  selector?: string;
  viewport?: ViewportName;
  name?: string;
}

export async function handleSmartDiff(
  browserManager: BrowserManager,
  input: SmartDiffInput,
  store?: BaselineStore,
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>; isError?: boolean }> {
  const { url } = await resolveUrl(input.url);
  const vp = resolveViewport(input.viewport);
  const viewportName = input.viewport ?? 'desktop';
  const name = input.name ?? generateBaselineName(url, viewportName, input.selector);

  // Always reload on compare to pick up code changes; baseline captures current state
  const shouldReload = input.action === 'compare';
  const page = await browserManager.getPage(url, vp, shouldReload);

  if (input.action === 'save_baseline') {
    const screenshot = await page.screenshot({ type: 'png' });
    const domSnapshot = await captureSnapshot(page);

    if (store) {
      await store.save(name, {
        screenshot,
        domSnapshot,
        timestamp: Date.now(),
        viewport: viewportName,
        url,
      });
    }

    const img = PNG.sync.read(screenshot);
    return {
      content: [
        { type: 'image', data: screenshot.toString('base64'), mimeType: 'image/png' },
        { type: 'text', text: `Smart baseline saved: '${name}'. ${img.width}x${img.height}px, ${domSnapshot.elements.length} elements captured.` },
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

  const currentScreenshot = await page.screenshot({ type: 'png' });
  const currentSnapshot = await captureSnapshot(page);

  // DOM diff
  const domChanges = baseline.domSnapshot
    ? compareDOMSnapshots(baseline.domSnapshot, currentSnapshot)
    : [];

  // Pixel diff
  const img1 = PNG.sync.read(baseline.screenshot);
  const img2 = PNG.sync.read(currentScreenshot);

  let diffBuffer: Buffer | null = null;
  let pixelInfo = '';

  if (img1.width === img2.width && img1.height === img2.height) {
    const diff = new PNG({ width: img1.width, height: img1.height });
    const numDiffPixels = pixelmatch(
      img1.data, img2.data, diff.data,
      img1.width, img1.height,
      { threshold: 0.1 }
    );
    const totalPixels = img1.width * img1.height;
    const diffPercent = ((numDiffPixels / totalPixels) * 100).toFixed(2);
    diffBuffer = PNG.sync.write(diff);
    pixelInfo = `Pixel diff: ${diffPercent}% changed`;
  } else {
    pixelInfo = `Size changed: ${img1.width}x${img1.height} → ${img2.width}x${img2.height}`;
  }

  // Format text report
  const report = formatReport(domChanges, currentSnapshot, baseline.domSnapshot, pixelInfo);

  const content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [
    { type: 'text', text: report },
  ];

  if (diffBuffer) {
    content.push({ type: 'image', data: diffBuffer.toString('base64'), mimeType: 'image/png' });
  }
  content.push({ type: 'image', data: currentScreenshot.toString('base64'), mimeType: 'image/png' });

  return { content };
}

function formatReport(
  changes: DOMChange[],
  current: DOMSnapshot,
  before: DOMSnapshot | undefined,
  pixelInfo: string
): string {
  if (changes.length === 0) {
    return `Smart diff: 0 changes detected\n\n${pixelInfo}\nViewport: ${current.viewport.width}x${current.viewport.height}`;
  }

  let report = `Smart diff: ${changes.length} changes detected\n`;

  const grouped: Record<string, DOMChange[]> = {};
  for (const change of changes) {
    const category = getCategoryLabel(change.type);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(change);
  }

  for (const [category, items] of Object.entries(grouped)) {
    report += `\n${category}:\n`;
    for (const item of items) {
      report += `  \u2022 ${item.description}\n`;
    }
  }

  if (before) {
    const heightDiff = current.pageHeight - before.pageHeight;
    if (heightDiff !== 0) {
      const sign = heightDiff > 0 ? '+' : '';
      report += `\nPage: height ${before.pageHeight}px → ${current.pageHeight}px (${sign}${heightDiff}px)`;
    }
  }

  report += `\n${pixelInfo}`;
  report += `\nViewport: ${current.viewport.width}x${current.viewport.height}`;

  return report;
}

function getCategoryLabel(type: DOMChange['type']): string {
  switch (type) {
    case 'added':
    case 'removed':
      return 'Structural';
    case 'moved':
    case 'resized':
      return 'Layout';
    case 'style-changed':
      return 'Styles';
    case 'text-changed':
      return 'Text';
  }
}
