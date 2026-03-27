export const DESIGN_GUIDE = `# Glimpse — Frontend Visual Feedback Skill

> This skill teaches you how to work with frontend code using visual feedback from Glimpse MCP tools.
> Read this BEFORE making any frontend changes.

---

## Core Principle

You can SEE the frontend. Use this ability constantly. Never make frontend changes blind.
The loop is: **look → understand → change → verify → look again**.

---

## Available Tools (Quick Reference)

| Tool | Returns | Token cost | When to use |
|------|---------|------------|-------------|
| \`page_outline\` | text | very low | FIRST on any new page |
| \`screenshot\` | image | medium | see specific section |
| \`screenshot_all\` | 3 images | high | check responsive |
| \`dom_inspect\` | text | very low | understand element styles |
| \`console_logs\` | text | very low | check for errors |
| \`smart_diff\` | text + images | high | before/after comparison |
| \`pixel_diff\` | images | medium | visual-only comparison |
| \`interact\` | image | medium | click/type/scroll/hover |

---

## Decision Tree: What To Do First

\`\`\`
User asks to change frontend
│
├─ Do you know which page?
│  ├─ NO → page_outline() on the main page, look at nav links
│  └─ YES → Do you know which section on the page?
│     ├─ NO → page_outline() to see sections
│     └─ YES → screenshot({ selector }) to see current state
│
├─ Is this a visual change (CSS, layout, styling)?
│  └─ YES → save smart_diff baseline BEFORE changing code
│
├─ Is this a logic change (JS, component behavior)?
│  └─ YES → interact() to test behavior after changes
│
└─ After ANY change:
   ├─ smart_diff compare (if baseline saved)
   ├─ console_logs({ type: "error" }) — always
   └─ screenshot_all() — if change might affect responsive
\`\`\`

---

## Workflow Patterns

### Pattern 1: Targeted Section Change

The most common case. User asks to change something specific.

\`\`\`
"change the pricing cards to have rounded corners and a shadow"
\`\`\`

**Step by step:**

1. \`page_outline()\` — find the right section selector
2. \`screenshot({ selector: "section.pricing" })\` — see what it looks like now
3. \`dom_inspect({ selector: ".pricing-card" })\` — know current styles
4. \`smart_diff({ action: "save_baseline", selector: "section.pricing" })\` — save "before"
5. **MAKE CODE CHANGES**
6. \`smart_diff({ action: "compare", selector: "section.pricing" })\` — verify
7. \`console_logs({ type: "error" })\` — check nothing broke
8. \`screenshot_all({ selector: "section.pricing" })\` — check responsive

**Key insight:** scope everything with \`selector\`. Never screenshot the whole page when you only changed one section.

### Pattern 2: Full Page Redesign

User asks to redesign an entire page.

1. \`page_outline()\` — understand full structure
2. Screenshot each section individually (not full page — loses detail)
3. \`smart_diff({ action: "save_baseline" })\` — save full page "before"
4. **Change section by section, not all at once.** For each:
   a. Make changes to that section
   b. \`screenshot({ selector: "section.xxx" })\` — verify
   c. \`console_logs({ type: "error" })\` — check errors
5. After all sections: \`smart_diff({ action: "compare" })\`
6. \`screenshot_all()\` — verify responsive

**Key insight:** change section by section, verify after each. Don't rewrite the entire page and then check.

### Pattern 3: Bug Fix (Visual)

User reports something looks wrong.

1. \`screenshot()\` — see the issue (use \`interact()\` to trigger state if needed)
2. \`dom_inspect({ selector: ".broken-element" })\` — check styles (z-index, position, etc)
3. \`dom_inspect({ selector: ".overlapping-element" })\` — compare
4. **FIX THE CODE**
5. Reproduce the state again (interact if needed)
6. \`screenshot()\` — confirm fix

### Pattern 4: Bug Fix (Functional)

User reports behavior issue ("form submits but nothing happens").

1. Use \`interact()\` to reproduce step by step:
   - \`interact({ action: "type", selector: "#email", text: "test@example.com" })\`
   - \`interact({ action: "click", selector: "button[type=submit]" })\`
2. \`console_logs({ type: "error" })\` — see JS errors
3. **FIX THE CODE**
4. Reproduce again to verify

### Pattern 5: Responsive Fix

1. \`screenshot({ viewport: "mobile" })\` — see broken state
2. \`screenshot({ viewport: "tablet" })\` — check tablet too
3. \`dom_inspect({ selector: "nav" })\` — check nav styles on mobile
4. \`smart_diff({ action: "save_baseline", viewport: "mobile" })\`
5. **FIX**
6. \`screenshot_all()\` — verify ALL viewports (fix mobile without breaking desktop)

### Pattern 6: State-Dependent UI

Testing dropdowns, modals, tooltips, hover effects.

1. \`screenshot()\` — default state
2. \`interact({ action: "hover", selector: ".dropdown-trigger" })\` — trigger state
3. \`screenshot({ selector: ".dropdown-menu" })\` — see it in detail
4. \`smart_diff({ action: "save_baseline" })\` — baseline WHILE state is active
5. **MAKE CHANGES**
6. \`interact({ action: "hover", selector: ".dropdown-trigger" })\` — trigger again
7. \`smart_diff({ action: "compare" })\`

**Key insight:** don't reload when you need to keep UI state.

---

## Selector Strategy

Good selectors make everything work. Bad selectors break everything.

### Priority order (best to worst):

1. **\`data-testid\`** — \`[data-testid="pricing-card"]\` — best, designed for testing
2. **Semantic + class** — \`section.pricing\` — good, stable
3. **ID** — \`#hero\` — good if exists
4. **Semantic tag** — \`header\`, \`nav\`, \`footer\`, \`main\` — good for landmarks
5. **Class** — \`.pricing-card\` — ok, might not be unique
6. **Complex** — \`.container > div:nth-child(3) .card\` — fragile, avoid

### How to find good selectors:

\`page_outline()\` shows available sections with selectors.
\`dom_inspect({ selector: "section" })\` shows what's there.

If the project uses CSS Modules (classes like \`.css-1a2b3c\`):
- Look for \`data-testid\` attributes first
- Use semantic tags: \`header\`, \`section\`, \`main\`
- Use ARIA attributes: \`[role="navigation"]\`, \`[aria-label="pricing"]\`

### When selector doesn't work:

1. \`page_outline()\` — see what selectors actually exist
2. Maybe the class name is different: \`.price-card\`, \`.pricingCard\`
3. Maybe the element appears only after an interaction — use \`interact()\` first

---

## Token Optimization

Images are expensive. Text is cheap. Be strategic.

### Low-cost information gathering:
- \`page_outline()\` — full page structure as text (~200 tokens)
- \`dom_inspect()\` — element details as text (~150 tokens)
- \`console_logs()\` — errors as text (~100 tokens)

### High-cost visual verification:
- \`screenshot()\` — one image (~1000 tokens)
- \`screenshot_all()\` — three images (~3000 tokens)
- \`smart_diff()\` — text + 2 images (~2500 tokens)

### Rules:
1. **Start with text tools** — \`page_outline\`, \`dom_inspect\`, \`console_logs\` are almost free
2. **Use \`selector\`** — screenshot of one section is way cheaper than full page
3. **Don't \`screenshot_all\` every time** — only when responsive matters
4. **\`smart_diff\` > \`pixel_diff\`** — smart_diff gives text description AND images

---

## Common Mistakes to Avoid

### Don't: Make changes without looking first
Always \`screenshot()\` or \`page_outline()\` BEFORE editing code.

### Don't: Screenshot the full page every time
Use \`selector\` to focus on the section you're working on. Full page is too zoomed out.

### Don't: Forget to save baseline before changes
If you forget \`smart_diff({ action: "save_baseline" })\` before editing, you can't compare.

### Don't: Reload when you need to keep state
If you're testing a modal or dropdown, don't reload the page.

### Don't: Ignore console errors
After ANY change: \`console_logs({ type: "error" })\`. Runtime errors are invisible in screenshots.

### Don't: Change everything at once
Work section by section. Change hero → verify → change pricing → verify → change footer → verify.

### Don't: Skip responsive check
If you changed any layout or sizing: \`screenshot_all()\` or at minimum \`screenshot({ viewport: "mobile" })\`.

### Don't: Assume the user's description is accurate
User says "the button is in the header". Maybe it's elsewhere. Always \`page_outline()\` + \`screenshot()\` first.

---

## Framework-Specific Tips

### React / Next.js
- Components often have generated class names — look for \`data-testid\`
- State changes won't persist after reload
- Next.js routes match filesystem: \`/app/settings/page.tsx\` → \`/settings\`

### Vue / Nuxt
- Vue uses \`data-v-xxxxx\` scoping — don't use as selectors
- Nuxt routes: \`/pages/settings.vue\` → \`/settings\`

### Tailwind CSS
- Elements often have no semantic classes, only utility classes
- \`dom_inspect\` is extra useful — shows computed styles regardless of how they're applied

### Plain HTML / CSS
- Easiest case — classes and IDs are what you see
- Use \`dom_inspect\` freely

---

## Quick Command Cheat Sheet

\`\`\`
# First time on a page
page_outline()

# See a specific section
screenshot({ selector: ".hero" })

# See responsive
screenshot_all({ selector: ".hero" })

# Understand element
dom_inspect({ selector: ".card" })

# Before/after workflow
smart_diff({ action: "save_baseline", selector: ".section" })
# ... make changes ...
smart_diff({ action: "compare", selector: ".section" })

# Check errors
console_logs({ type: "error" })

# Click something
interact({ action: "click", selector: ".button" })

# Fill a form
interact({ action: "type", selector: "#email", text: "test@example.com" })
\`\`\`
`;
