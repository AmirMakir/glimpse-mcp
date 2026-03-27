import { DOMSnapshot, ElementSnapshot } from './snapshot.js';

export interface DOMChange {
  type: 'moved' | 'resized' | 'style-changed' | 'added' | 'removed' | 'text-changed';
  selector: string;
  description: string;
  details?: Record<string, { before: string; after: string }>;
}

const BOUNDS_THRESHOLD = 2; // px

export function compareDOMSnapshots(before: DOMSnapshot, after: DOMSnapshot): DOMChange[] {
  const changes: DOMChange[] = [];

  const beforeMap = new Map<string, ElementSnapshot>();
  for (const el of before.elements) {
    beforeMap.set(el.selector, el);
  }

  const afterMap = new Map<string, ElementSnapshot>();
  for (const el of after.elements) {
    afterMap.set(el.selector, el);
  }

  // Find removed elements
  for (const [selector] of beforeMap) {
    if (!afterMap.has(selector)) {
      changes.push({
        type: 'removed',
        selector,
        description: `${selector} — removed`,
      });
    }
  }

  // Find added elements
  for (const [selector, el] of afterMap) {
    if (!beforeMap.has(selector)) {
      changes.push({
        type: 'added',
        selector,
        description: `${selector} — new element at (${el.bounds.x}, ${el.bounds.y}), ${el.bounds.width}x${el.bounds.height}px`,
      });
    }
  }

  // Compare matched elements
  for (const [selector, beforeEl] of beforeMap) {
    const afterEl = afterMap.get(selector);
    if (!afterEl) continue;

    // Check moved
    const dx = afterEl.bounds.x - beforeEl.bounds.x;
    const dy = afterEl.bounds.y - beforeEl.bounds.y;
    if (Math.abs(dx) > BOUNDS_THRESHOLD || Math.abs(dy) > BOUNDS_THRESHOLD) {
      const xStr = dx >= 0 ? `+${dx}px` : `${dx}px`;
      const yStr = dy >= 0 ? `+${dy}px` : `${dy}px`;
      changes.push({
        type: 'moved',
        selector,
        description: `${selector} — moved: x ${xStr}, y ${yStr}`,
      });
    }

    // Check resized
    const dw = afterEl.bounds.width - beforeEl.bounds.width;
    const dh = afterEl.bounds.height - beforeEl.bounds.height;
    if (Math.abs(dw) > BOUNDS_THRESHOLD || Math.abs(dh) > BOUNDS_THRESHOLD) {
      changes.push({
        type: 'resized',
        selector,
        description: `${selector} — resized: width ${beforeEl.bounds.width}px → ${afterEl.bounds.width}px, height ${beforeEl.bounds.height}px → ${afterEl.bounds.height}px`,
      });
    }

    // Check style changes
    const styleDetails: Record<string, { before: string; after: string }> = {};
    const allStyleKeys = new Set([
      ...Object.keys(beforeEl.styles),
      ...Object.keys(afterEl.styles),
    ]);

    for (const key of allStyleKeys) {
      const bVal = beforeEl.styles[key] ?? '';
      const aVal = afterEl.styles[key] ?? '';
      if (bVal !== aVal) {
        styleDetails[key] = { before: bVal, after: aVal };
      }
    }

    if (Object.keys(styleDetails).length > 0) {
      const desc = Object.entries(styleDetails)
        .map(([prop, { before: b, after: a }]) => {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          return `${cssProp}: ${b || '(none)'} → ${a || '(none)'}`;
        })
        .join(', ');
      changes.push({
        type: 'style-changed',
        selector,
        description: `${selector} — ${desc}`,
        details: styleDetails,
      });
    }

    // Check text changes
    if (beforeEl.text !== afterEl.text) {
      changes.push({
        type: 'text-changed',
        selector,
        description: `${selector} — text changed`,
        details: { text: { before: beforeEl.text, after: afterEl.text } },
      });
    }
  }

  // Sort by priority: removed/added > moved/resized > style-changed > text-changed
  const priority: Record<DOMChange['type'], number> = {
    removed: 0,
    added: 1,
    moved: 2,
    resized: 3,
    'style-changed': 4,
    'text-changed': 5,
  };

  changes.sort((a, b) => priority[a.type] - priority[b.type]);

  return changes;
}
