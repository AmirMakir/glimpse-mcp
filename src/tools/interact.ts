import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface InteractInput {
  action: 'click' | 'type' | 'scroll' | 'hover' | 'select' | 'press_key';
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  amount?: number;
  screenshot?: boolean;
  viewport?: ViewportName;
  wait?: number;
}

export async function handleInteract(
  browserManager: BrowserManager,
  input: InteractInput
): Promise<{ content: Array<{ type: string; data?: string; mimeType?: string; text?: string }>; isError?: boolean }> {
  const { url } = await resolveUrl(input.url);
  const vp = resolveViewport(input.viewport);
  const page = await browserManager.getPage(url, vp);

  // Enable animations so Claude can see transitions and hover effects
  await browserManager.enableAnimations();

  const { action, selector } = input;

  if (['click', 'type', 'hover', 'select'].includes(action) && !selector) {
    return {
      content: [{ type: 'text', text: `Error: selector is required for '${action}' action.` }],
      isError: true,
    };
  }

  let actionDescription = '';

  switch (action) {
    case 'click':
      await page.click(selector!, { timeout: 5000 });
      actionDescription = `Clicked ${selector}`;
      break;

    case 'type':
      await page.fill(selector!, input.text ?? '');
      actionDescription = `Typed "${input.text ?? ''}" into ${selector}`;
      break;

    case 'scroll': {
      const direction = input.direction ?? 'down';
      const amount = input.amount ?? 500;
      const deltaX = direction === 'right' ? amount : direction === 'left' ? -amount : 0;
      const deltaY = direction === 'down' ? amount : direction === 'up' ? -amount : 0;
      await page.mouse.wheel(deltaX, deltaY);
      actionDescription = `Scrolled ${direction} by ${amount}px`;
      break;
    }

    case 'hover':
      await page.hover(selector!, { timeout: 5000 });
      actionDescription = `Hovered over ${selector}`;
      break;

    case 'select':
      await page.selectOption(selector!, input.value ?? '');
      actionDescription = `Selected "${input.value ?? ''}" in ${selector}`;
      break;

    case 'press_key':
      await page.keyboard.press(input.text ?? 'Enter');
      actionDescription = `Pressed key: ${input.text ?? 'Enter'}`;
      break;
  }

  // Wait for page to stabilize after action
  await page.waitForTimeout(input.wait ?? 500);
  await page.waitForLoadState('networkidle').catch(() => {});

  const content: Array<{ type: string; data?: string; mimeType?: string; text?: string }> = [
    { type: 'text', text: `Action: ${actionDescription}` },
  ];

  if (input.screenshot !== false) {
    const buffer = await page.screenshot({ type: 'png' });
    content.push({ type: 'image', data: buffer.toString('base64'), mimeType: 'image/png' });
  }

  return { content };
}
