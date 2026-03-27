import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface ScreenshotInput {
  url?: string;
  selector?: string;
  viewport?: ViewportName;
  full_page?: boolean;
  reload?: boolean;
}

const MAX_FULL_PAGE_HEIGHT = 10000;

export async function handleScreenshot(
  browserManager: BrowserManager,
  input: ScreenshotInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> }> {
  const { url } = await resolveUrl(input.url);
  const viewport = resolveViewport(input.viewport);
  const page = await browserManager.getPage(url, viewport, input.reload);

  let buffer: Buffer;
  let meta: string;

  if (input.selector) {
    const element = await page.waitForSelector(input.selector, { timeout: 5000 });
    if (!element) {
      return {
        content: [{ type: 'text', text: `Element not found: ${input.selector}` }],
      };
    }
    buffer = await element.screenshot({ type: 'png' });
    meta = `Screenshot taken: element "${input.selector}", url: ${url}, viewport: ${input.viewport ?? 'desktop'}`;
  } else {
    const fullPage = input.full_page ?? false;

    if (fullPage) {
      // Check page height and clip if needed
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (pageHeight > MAX_FULL_PAGE_HEIGHT) {
        buffer = await page.screenshot({
          type: 'png',
          clip: { x: 0, y: 0, width: viewport.width, height: MAX_FULL_PAGE_HEIGHT },
        });
        meta = `Screenshot taken: ${viewport.width}x${MAX_FULL_PAGE_HEIGHT} (clipped from ${pageHeight}px), url: ${url}, viewport: ${input.viewport ?? 'desktop'}`;
      } else {
        buffer = await page.screenshot({ type: 'png', fullPage: true });
        meta = `Screenshot taken: ${viewport.width}x${pageHeight} (full page), url: ${url}, viewport: ${input.viewport ?? 'desktop'}`;
      }
    } else {
      buffer = await page.screenshot({ type: 'png' });
      meta = `Screenshot taken: ${viewport.width}x${viewport.height}, url: ${url}, viewport: ${input.viewport ?? 'desktop'}`;
    }
  }

  return {
    content: [
      { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' },
      { type: 'text', text: meta },
    ],
  };
}
