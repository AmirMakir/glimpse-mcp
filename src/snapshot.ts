import { Page } from 'playwright';
import { STYLE_PROPERTIES } from './utils.js';

export interface ElementSnapshot {
  selector: string;
  tag: string;
  bounds: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
  text: string;
  visible: boolean;
  children: number;
}

export interface DOMSnapshot {
  url: string;
  viewport: { width: number; height: number };
  timestamp: number;
  elements: ElementSnapshot[];
  pageHeight: number;
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'PATH', 'NOSCRIPT']);
const SEMANTIC_TAGS = new Set([
  'HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'FOOTER', 'ASIDE',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BUTTON', 'A', 'IMG', 'FORM', 'INPUT',
]);

export async function captureSnapshot(page: Page): Promise<DOMSnapshot> {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const url = page.url();

  const result = await page.evaluate(
    ({ styleProps, skipTags, semanticTags, maxElements }) => {
      function generateSelector(el: Element): string {
        if (el.id) return `#${el.id}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        const tag = el.tagName.toLowerCase();
        const classes = Array.from(el.classList).join('.');
        let base = classes ? `${tag}.${classes}` : tag;

        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            (c) => c.tagName === el.tagName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(el) + 1;
            base += `:nth-child(${index})`;
          }
        }

        // Walk up to nearest element with id
        if (parent && parent !== document.body && parent !== document.documentElement) {
          if (parent.id) {
            return `#${parent.id} > ${base}`;
          }
        }

        return base;
      }

      const skipSet = new Set(skipTags);
      const semanticSet = new Set(semanticTags);
      const allElements = document.querySelectorAll('*');
      const prioritized: { el: Element; priority: number }[] = [];

      for (const el of allElements) {
        if (skipSet.has(el.tagName)) continue;
        // Skip SVG internals
        if (el.closest('svg') && el.tagName !== 'SVG') continue;

        let priority = 3; // lowest
        if (el.id || el.className || el.getAttribute('data-testid') || el.getAttribute('data-component')) {
          priority = 1;
        } else if (semanticSet.has(el.tagName)) {
          priority = 2;
        }

        prioritized.push({ el, priority });
      }

      // Sort by priority, take max
      prioritized.sort((a, b) => a.priority - b.priority);
      const selected = prioritized.slice(0, maxElements);

      const elements = selected.map(({ el }) => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);

        const styles: Record<string, string> = {};
        for (const prop of styleProps) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          const value = computed.getPropertyValue(cssProp);
          if (value && value !== '') {
            styles[prop] = value;
          }
        }

        const visible =
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          computed.opacity !== '0' &&
          rect.width > 0 &&
          rect.height > 0;

        return {
          selector: generateSelector(el),
          tag: el.tagName.toLowerCase(),
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
          styles,
          text: (el.textContent ?? '').trim().slice(0, 100),
          visible,
          children: el.children.length,
        };
      });

      return {
        elements,
        pageHeight: document.documentElement.scrollHeight,
      };
    },
    {
      styleProps: STYLE_PROPERTIES,
      skipTags: Array.from(SKIP_TAGS),
      semanticTags: Array.from(SEMANTIC_TAGS),
      maxElements: 200,
    }
  );

  return {
    url,
    viewport,
    timestamp: Date.now(),
    elements: result.elements,
    pageHeight: result.pageHeight,
  };
}
