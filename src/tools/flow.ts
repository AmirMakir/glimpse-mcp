import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface FlowStep {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'hover' | 'select' | 'press_key' | 'wait' | 'screenshot';
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  timeout?: number;
}

export interface FlowInput {
  steps: FlowStep[];
  screenshot_each?: boolean;
  viewport?: ViewportName;
  url?: string;
}

export async function handleFlow(
  browserManager: BrowserManager,
  input: FlowInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> }> {
  const startUrl = input.url ? (await resolveUrl(input.url)).url : undefined;
  const vp = resolveViewport(input.viewport);
  const steps = input.steps;

  if (!steps || steps.length === 0) {
    return { content: [{ type: 'text', text: 'Error: steps array is required and must not be empty.' }] };
  }

  // Enable animations for flow testing
  await browserManager.enableAnimations();

  // Ensure page is open
  if (startUrl) {
    await browserManager.getPage(startUrl, vp);
  }

  const results: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const label = `Step ${i + 1}/${steps.length}`;

    try {
      const page = await browserManager.getPage(
        step.url || startUrl || (await resolveUrl()).url,
        vp,
        step.action === 'navigate'
      );

      switch (step.action) {
        case 'navigate':
          if (step.url) {
            await page.goto(step.url, { timeout: 15000, waitUntil: 'load' });
            await page.waitForLoadState('networkidle').catch(() => {});
          }
          break;

        case 'click':
          await page.click(step.selector!, { timeout: 5000 });
          break;

        case 'type':
          await page.fill(step.selector!, step.text ?? '');
          break;

        case 'scroll': {
          const dir = step.direction ?? 'down';
          const amt = step.amount ?? 500;
          const dx = dir === 'right' ? amt : dir === 'left' ? -amt : 0;
          const dy = dir === 'down' ? amt : dir === 'up' ? -amt : 0;
          await page.mouse.wheel(dx, dy);
          break;
        }

        case 'hover':
          await page.hover(step.selector!, { timeout: 5000 });
          break;

        case 'select':
          await page.selectOption(step.selector!, step.value ?? '');
          break;

        case 'press_key':
          await page.keyboard.press(step.text ?? 'Enter');
          break;

        case 'wait':
          if (step.selector) {
            await page.waitForSelector(step.selector, { timeout: step.timeout ?? 5000 });
          } else {
            await page.waitForTimeout(step.timeout ?? 1000);
          }
          break;

        case 'screenshot':
          // Just take screenshot, no action
          break;
      }

      // Stabilize
      if (step.action !== 'wait' && step.action !== 'screenshot') {
        await page.waitForTimeout(500);
        await page.waitForLoadState('networkidle').catch(() => {});
      }

      // Screenshot
      const desc = formatStepDescription(step);
      if (input.screenshot_each !== false || step.action === 'screenshot') {
        const buffer = await page.screenshot({ type: 'png' });
        results.push(
          { type: 'text', text: `${label}: ${desc}` },
          { type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' }
        );
      } else {
        results.push({ type: 'text', text: `${label}: ${desc} ✓` });
      }
    } catch (error: any) {
      const desc = formatStepDescription(step);
      results.push({ type: 'text', text: `${label}: ${desc} ✗ — ${error.message}` });

      // Screenshot the error state
      try {
        const page = await browserManager.getPage(
          startUrl || (await resolveUrl()).url, vp
        );
        const buffer = await page.screenshot({ type: 'png' });
        results.push({ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' });
      } catch {}
    }
  }

  results.push({ type: 'text', text: `Flow complete: ${steps.length} steps` });
  return { content: results };
}

function formatStepDescription(step: FlowStep): string {
  switch (step.action) {
    case 'navigate': return `navigate to ${step.url}`;
    case 'click': return `click ${step.selector}`;
    case 'type': return `type "${step.text}" into ${step.selector}`;
    case 'scroll': return `scroll ${step.direction ?? 'down'} ${step.amount ?? 500}px`;
    case 'hover': return `hover ${step.selector}`;
    case 'select': return `select "${step.value}" in ${step.selector}`;
    case 'press_key': return `press ${step.text ?? 'Enter'}`;
    case 'wait': return `wait for ${step.selector ?? `${step.timeout}ms`}`;
    case 'screenshot': return 'screenshot';
    default: return step.action;
  }
}
