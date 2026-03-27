import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, STYLE_PROPERTIES, camelToKebab, ToolResult } from '../utils.js';

export interface DomInspectInput {
  url?: string;
  selector: string;
  reload?: boolean;
}

export async function handleDomInspect(
  browserManager: BrowserManager,
  input: DomInspectInput
): Promise<ToolResult> {
  const { url } = await resolveUrl(input.url);
  const viewport = resolveViewport();
  const page = await browserManager.getPage(url, viewport, input.reload);

  const element = await page.waitForSelector(input.selector, { timeout: 5000 });
  if (!element) {
    return {
      content: [{ type: 'text', text: `Element not found: ${input.selector}. Check if the selector is correct and the element is rendered.` }],
    };
  }

  const info = await page.evaluate(
    ({ selector, styleProps }) => {
      const el = document.querySelector(selector);
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      const computed = window.getComputedStyle(el);

      const styles: Record<string, string> = {};
      for (const prop of styleProps) {
        const value = computed.getPropertyValue(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );
        if (value && value !== '' && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
          styles[prop] = value;
        }
      }

      const attributes: Record<string, string> = {};
      for (const attr of el.attributes) {
        attributes[attr.name] = attr.value;
      }

      return {
        tag: el.tagName.toLowerCase(),
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        text: (el.textContent ?? '').trim().slice(0, 200),
        children: el.children.length,
        styles,
        attributes,
      };
    },
    { selector: input.selector, styleProps: STYLE_PROPERTIES }
  );

  if (!info) {
    return {
      content: [{ type: 'text', text: `Element not found: ${input.selector}` }],
    };
  }

  let output = `Element: ${input.selector}\n`;
  output += `Tag: ${info.tag}\n`;
  output += `Bounding box: x=${info.bounds.x}, y=${info.bounds.y}, width=${info.bounds.width}, height=${info.bounds.height}\n`;
  output += `Text content: "${info.text}"\n`;
  output += `Children: ${info.children} direct children\n`;

  output += '\nComputed styles:\n';
  for (const [prop, value] of Object.entries(info.styles)) {
    output += `  ${camelToKebab(prop)}: ${value}\n`;
  }

  output += '\nAttributes:\n';
  for (const [name, value] of Object.entries(info.attributes)) {
    output += `  ${name}="${value}"\n`;
  }

  return {
    content: [{ type: 'text', text: output.trimEnd() }],
  };
}
