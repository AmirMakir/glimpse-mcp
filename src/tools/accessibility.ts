import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface AccessibilityInput {
  url?: string;
  selector?: string;
  viewport?: ViewportName;
  tags?: string[];
}

let axeSource: string | null = null;

function getAxeSource(): string {
  if (axeSource) return axeSource;
  const require = createRequire(import.meta.url);
  const axePath = require.resolve('axe-core/axe.min.js');
  axeSource = readFileSync(axePath, 'utf-8');
  return axeSource;
}

export async function handleAccessibility(
  browserManager: BrowserManager,
  input: AccessibilityInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>; isError?: boolean }> {
  const { url } = await resolveUrl(input.url);
  const vp = resolveViewport(input.viewport);
  const page = await browserManager.getPage(url, vp, true);

  // Inject axe-core
  await page.evaluate(getAxeSource());

  // Run audit
  const tags = input.tags ?? ['wcag2a', 'wcag2aa'];
  const selector = input.selector;

  // Validate selector exists before running audit
  if (selector) {
    const el = await page.$(selector);
    if (!el) {
      return {
        content: [{ type: 'text', text: `Element not found: ${selector}. Cannot scope accessibility audit.` }],
        isError: true,
      };
    }
  }

  const results = await page.evaluate(async ({ tags, selector }: { tags: string[]; selector?: string }) => {
    const context = selector ? document.querySelector(selector) ?? document : document;
    return await (globalThis as Record<string, any>).axe.run(context, {
      runOnly: { type: 'tag', values: tags },
    });
  }, { tags, selector });

  // Format results
  interface AxeViolation {
    id: string;
    impact: string;
    description: string;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: string[];
      failureSummary: string;
    }>;
  }

  const axeResults = results as { violations: AxeViolation[]; passes?: unknown[] };
  const violations = axeResults.violations;
  const passes = axeResults.passes?.length ?? 0;

  if (violations.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `Accessibility audit: ${url}\n${passes} checks passed, 0 issues found.\n\nAll checked WCAG rules pass. Nice work!`,
      }],
    };
  }

  let report = `Accessibility audit: ${url}\n${passes} checks passed, ${violations.length} issues found\n`;

  const severityOrder: Record<string, number> = { critical: 0, serious: 1, moderate: 2, minor: 3 };

  const sorted = [...violations].sort(
    (a, b) => (severityOrder[a.impact] ?? 4) - (severityOrder[b.impact] ?? 4)
  );

  for (const v of sorted) {
    report += `\n[${v.impact}] ${v.id}: ${v.help}`;

    for (const node of v.nodes.slice(0, 3)) {
      const target = node.target.join(', ');
      report += `\n  Element: ${target}`;
      if (node.failureSummary) {
        const fix = node.failureSummary.split('\n').filter(l => l.trim()).slice(0, 2).join('; ');
        report += `\n  Fix: ${fix}`;
      }
    }

    if (v.nodes.length > 3) {
      report += `\n  ... and ${v.nodes.length - 3} more elements`;
    }

    report += `\n  Help: ${v.helpUrl}`;
  }

  // Summary
  const counts: Record<string, number> = {};
  for (const v of violations) {
    counts[v.impact] = (counts[v.impact] ?? 0) + 1;
  }
  const summary = Object.entries(counts)
    .sort(([a], [b]) => (severityOrder[a] ?? 4) - (severityOrder[b] ?? 4))
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');

  report += `\n\nSummary: ${summary}`;

  return { content: [{ type: 'text', text: report }] };
}
