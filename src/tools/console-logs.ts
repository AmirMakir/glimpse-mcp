import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport } from '../utils.js';

export interface ConsoleLogsInput {
  url?: string;
  type?: 'all' | 'error' | 'warning' | 'log' | 'info';
  clear?: boolean;
}

export async function handleConsoleLogs(
  browserManager: BrowserManager,
  input: ConsoleLogsInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  // If url provided, ensure page is open to collect logs
  if (input.url) {
    const { url } = await resolveUrl(input.url);
    const viewport = resolveViewport();
    await browserManager.getPage(url, viewport);
  }

  let logs = browserManager.getConsoleLogs();
  const filterType = input.type ?? 'all';

  if (filterType !== 'all') {
    logs = logs.filter((entry) => entry.type === filterType);
  }

  if (input.clear) {
    browserManager.clearConsoleLogs();
  }

  if (logs.length === 0) {
    return {
      content: [{ type: 'text', text: `Console logs (0 entries, showing: ${filterType}):\n\nNo logs captured.` }],
    };
  }

  const formatted = logs
    .map((entry) => {
      let line = `[${entry.type}] ${entry.text}`;
      if (entry.location) {
        line += `\n  at ${entry.location}`;
      }
      return line;
    })
    .join('\n\n');

  return {
    content: [
      { type: 'text', text: `Console logs (${logs.length} entries, showing: ${filterType}):\n\n${formatted}` },
    ],
  };
}
