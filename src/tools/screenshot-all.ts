import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface ScreenshotAllInput {
  url?: string;
  selector?: string;
  full_page?: boolean;
  viewports?: ViewportName[];
}

export async function handleScreenshotAll(
  browserManager: BrowserManager,
  input: ScreenshotAllInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> }> {
  const { url } = await resolveUrl(input.url);
  const viewportNames = input.viewports ?? ['mobile', 'tablet', 'desktop'] as ViewportName[];

  const content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [];

  for (const vpName of viewportNames) {
    const viewport = resolveViewport(vpName);
    const page = await browserManager.getPage(url, viewport);

    let buffer: Buffer;

    if (input.selector) {
      const element = await page.waitForSelector(input.selector, { timeout: 5000 });
      if (!element) {
        content.push({ type: 'text', text: `=== ${vpName} (${viewport.width}x${viewport.height}) === Element not found: ${input.selector}` });
        continue;
      }
      buffer = await element.screenshot({ type: 'png' });
    } else {
      buffer = await page.screenshot({ type: 'png', fullPage: input.full_page ?? false });
    }

    content.push({ type: 'text', text: `=== ${vpName} (${viewport.width}x${viewport.height}) ===` });
    content.push({ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' });
  }

  return { content };
}
