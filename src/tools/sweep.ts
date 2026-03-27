import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface SweepInput {
  urls: string[];
  viewport?: ViewportName;
  checks?: ('screenshot' | 'console')[];
}

export async function handleSweep(
  browserManager: BrowserManager,
  input: SweepInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> }> {
  const { urls } = input;

  if (!urls || urls.length === 0) {
    return { content: [{ type: 'text', text: 'Error: urls array is required and must not be empty.' }] };
  }

  const vp = resolveViewport(input.viewport);
  const checks = input.checks ?? ['screenshot', 'console'];
  const baseUrl = (await resolveUrl()).url;

  const results: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [];
  let reportLines: string[] = [`Sweep: ${urls.length} pages`];

  for (const rawUrl of urls) {
    // Resolve paths like "/about" against base URL
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;

    browserManager.clearConsoleLogs();

    try {
      const page = await browserManager.getPage(fullUrl, vp, true);

      let hasErrors = false;
      let pageReport = `\n✓ ${rawUrl}`;

      // Screenshot
      if (checks.includes('screenshot')) {
        const buffer = await page.screenshot({ type: 'png' });
        results.push(
          { type: 'text', text: `=== ${rawUrl} ===` },
          { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }
        );
      }

      // Console errors
      if (checks.includes('console')) {
        const logs = browserManager.getConsoleLogs();
        const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
        const warnings = logs.filter(l => l.type === 'warning');

        pageReport += `\n  Console: ${errors.length} errors, ${warnings.length} warnings`;

        if (errors.length > 0) {
          hasErrors = true;
          for (const err of errors.slice(0, 5)) {
            pageReport += `\n    [error] ${err.text}`;
            if (err.location) pageReport += `\n      at ${err.location}`;
          }
          if (errors.length > 5) {
            pageReport += `\n    ... and ${errors.length - 5} more errors`;
          }
        }
      }

      if (hasErrors) {
        pageReport = pageReport.replace('✓', '✗');
      }

      reportLines.push(pageReport);
    } catch (error: any) {
      reportLines.push(`\n✗ ${rawUrl}\n  Failed to load: ${error.message}`);
    }
  }

  // Add summary report at the beginning
  results.unshift({ type: 'text', text: reportLines.join('') });

  return { content: results };
}
