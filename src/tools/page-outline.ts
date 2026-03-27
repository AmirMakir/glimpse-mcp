import { BrowserManager } from '../browser.js';
import { resolveUrl } from '../port-discovery.js';
import { resolveViewport, ViewportName } from '../utils.js';

export interface PageOutlineInput {
  url?: string;
  viewport?: ViewportName;
  reload?: boolean;
}

interface SectionInfo {
  selector: string;
  tag: string;
  y: number;
  height: number;
  width: number;
  text_preview: string;
  children_count: number;
}

interface HeadingInfo {
  level: number;
  text: string;
  y: number;
  parent_selector: string;
}

interface LinkInfo {
  text: string;
  href: string;
  location: string;
}

interface PageOutlineData {
  sections: SectionInfo[];
  headings: HeadingInfo[];
  links: LinkInfo[];
  pageHeight: number;
}

export async function handlePageOutline(
  browserManager: BrowserManager,
  input: PageOutlineInput
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const { url } = await resolveUrl(input.url);
  const viewport = resolveViewport(input.viewport);
  const page = await browserManager.getPage(url, viewport, input.reload);

  const outline: PageOutlineData = await page.evaluate(() => {
    // --- Helper: generate a readable selector for an element ---
    function genSelector(el: Element): string {
      const tag = el.tagName.toLowerCase();
      if (el.id) return `${tag}#${el.id}`;
      const testId = el.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;
      const classes = Array.from(el.classList).filter(c => c.length < 30).slice(0, 2).join('.');
      if (classes) return `${tag}.${classes}`;
      return tag;
    }

    // --- Helper: find the closest named section parent ---
    function findParentSection(el: Element): string {
      let current = el.parentElement;
      while (current && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        if (['header', 'footer', 'main', 'nav', 'aside', 'section', 'article'].includes(tag) || current.id) {
          return genSelector(current);
        }
        current = current.parentElement;
      }
      return 'body';
    }

    // --- 1. Sections ---
    const sectionSelectors = [
      'header', 'footer', 'main', 'nav', 'aside',
      'section', 'article',
      '[data-section]', '[data-testid]',
    ];

    const sectionSet = new Set<Element>();
    for (const sel of sectionSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        sectionSet.add(el);
      }
    }
    // Add elements with id (not script/style/link)
    for (const el of document.querySelectorAll('[id]:not(script):not(style):not(link):not(meta)')) {
      const tag = el.tagName.toLowerCase();
      if (['header', 'footer', 'main', 'nav', 'aside', 'section', 'article', 'div'].includes(tag)) {
        sectionSet.add(el);
      }
    }

    let sections: SectionInfo[] = [];
    for (const el of sectionSet) {
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) continue;

      sections.push({
        selector: genSelector(el),
        tag: el.tagName.toLowerCase(),
        y: Math.round(rect.y + window.scrollY),
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        text_preview: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
        children_count: el.children.length,
      });
    }

    // Dedupe by selector, sort by y, limit 30
    const seenSelectors = new Set<string>();
    sections = sections
      .sort((a, b) => a.y - b.y)
      .filter((s) => {
        if (seenSelectors.has(s.selector)) return false;
        seenSelectors.add(s.selector);
        return true;
      })
      .slice(0, 30);

    // --- 2. Headings ---
    const headingEls = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let headings: HeadingInfo[] = [];

    for (const el of headingEls) {
      const rect = el.getBoundingClientRect();
      headings.push({
        level: parseInt(el.tagName[1]!),
        text: (el.textContent ?? '').trim().slice(0, 100),
        y: Math.round(rect.y + window.scrollY),
        parent_selector: findParentSection(el),
      });
    }

    headings.sort((a, b) => a.y - b.y);
    // If over 30, drop h5-h6 first
    if (headings.length > 30) {
      headings = headings.filter((h) => h.level <= 4).slice(0, 30);
    }

    // --- 3. Nav links ---
    const linkSet = new Map<string, LinkInfo>();

    function addLink(el: Element, location: string) {
      const anchor = el as HTMLAnchorElement;
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      if (linkSet.has(href)) return;

      linkSet.set(href, {
        text: (anchor.textContent ?? '').trim().slice(0, 40),
        href,
        location,
      });
    }

    // Priority order: nav > header > footer > body
    for (const el of document.querySelectorAll('nav a[href]')) addLink(el, 'nav');
    for (const el of document.querySelectorAll('header a[href]')) addLink(el, 'header');
    for (const el of document.querySelectorAll('footer a[href]')) addLink(el, 'footer');
    for (const el of document.querySelectorAll('a[href^="/"], a[href^="./"], a[href^="#"]')) addLink(el, 'body');

    const links = Array.from(linkSet.values()).slice(0, 20);

    return {
      sections,
      headings,
      links,
      pageHeight: document.documentElement.scrollHeight,
    };
  });

  // Format output
  const vpName = input.viewport ?? 'desktop';
  const vp = resolveViewport(vpName);
  let text = `Page outline: ${url}\n`;
  text += `Viewport: ${vpName} (${vp.width}x${vp.height})\n`;
  text += `Page height: ${outline.pageHeight}px\n`;

  // Sections
  text += '\n## Sections (top to bottom)\n\n';
  if (outline.sections.length === 0) {
    text += '  (no sections found)\n';
  } else {
    const maxSel = Math.max(...outline.sections.map((s) => s.selector.length));
    for (const s of outline.sections) {
      const sel = s.selector.padEnd(maxSel + 2);
      text += `  ${sel}y=${s.y}      h=${s.height}px    "${s.text_preview}"\n`;
    }
  }

  // Headings
  text += '\n## Headings\n\n';
  if (outline.headings.length === 0) {
    text += '  (no headings found)\n';
  } else {
    for (const h of outline.headings) {
      text += `  h${h.level}  "${h.text}"     (in ${h.parent_selector})\n`;
    }
  }

  // Links
  text += '\n## Nav links\n\n';
  if (outline.links.length === 0) {
    text += '  (no nav links found)\n';
  } else {
    const maxText = Math.max(...outline.links.map((l) => l.text.length));
    for (const l of outline.links) {
      const t = `"${l.text}"`.padEnd(maxText + 4);
      text += `  ${t}\u2192 ${l.href}\n`;
    }
  }

  text += '\nTip: Use screenshot({ selector: "section.pricing" }) to capture a specific section.';

  return {
    content: [{ type: 'text', text }],
  };
}
