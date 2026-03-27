# Glimpse — Visual Feedback for AI Agents

You have access to Glimpse MCP tools. Use them to SEE the frontend. **Never make frontend changes blind.**

The loop is: **look → understand → change → verify → look again**.

---

## What To Do First

```
User asks to change frontend
│
├─ Don't know which section? → page_outline() to see all sections
├─ Know the section? → screenshot({ selector: "..." }) to see it now
│
├─ Visual change (CSS/layout)? → smart_diff save_baseline BEFORE editing code
├─ Behavior change (JS)? → interact() to test after changes
│
└─ After ANY change:
   1. smart_diff compare (if baseline was saved)
   2. console_logs({ type: "error" }) — always check
   3. screenshot_all() — if layout/sizing changed
```

---

## Tools

| Tool | Use for |
|------|---------|
| `page_outline()` | **Start here.** See sections, headings, nav links |
| `screenshot({ selector: ".hero" })` | See a specific section |
| `screenshot_all()` | Check mobile + tablet + desktop |
| `dom_inspect({ selector: ".card" })` | Get element's CSS, size, position |
| `console_logs({ type: "error" })` | Check for JS errors |
| `smart_diff({ action: "save_baseline" })` | Save state BEFORE changes |
| `smart_diff({ action: "compare" })` | See what changed AFTER |
| `pixel_diff(...)` | Simple pixel comparison |
| `interact({ action: "click", selector: ".btn" })` | Click, type, scroll, hover |
| `flow({ steps: [...] })` | Multi-step user journey (login, checkout) |
| `sweep({ urls: ["/", "/about"] })` | Scan multiple pages at once |
| `accessibility()` | WCAG audit: contrast, alt text, ARIA |

---

## Required Workflow for Visual Changes

**You MUST follow this workflow for any CSS, layout, or styling change:**

1. `page_outline()` — find the right section selector
2. `screenshot({ selector: "section.xxx" })` — see current state
3. `dom_inspect({ selector: ".element" })` — understand current styles
4. `smart_diff({ action: "save_baseline", selector: "section.xxx" })` — **save before**
5. Make your code changes
6. `smart_diff({ action: "compare", selector: "section.xxx" })` — **verify changes**
7. `console_logs({ type: "error" })` — check nothing broke
8. If layout changed: `screenshot_all({ selector: "section.xxx" })` — check responsive

**Always scope with `selector`.** Don't screenshot the whole page when you only changed one section.

---

## Rules

### Work section by section
For big changes, don't rewrite everything at once. Change hero → verify → change pricing → verify → change footer → verify. If something breaks, you know which change caused it.

### Save baseline BEFORE editing code
If you forget `smart_diff({ action: "save_baseline" })` before editing, you can't compare. Do it first.

### Always check console errors
After ANY change: `console_logs({ type: "error" })`. Runtime errors are invisible in screenshots but break the app.

### Check responsive
If you changed any layout, spacing, or sizing: `screenshot_all()` or at minimum `screenshot({ viewport: "mobile" })`.

### Don't assume — look first
User says "the button is in the header". Maybe it's not. Always `page_outline()` + `screenshot()` to see the actual structure.

### Don't reload when testing UI state
If testing a modal, dropdown, or hover effect — don't reload. Use `interact()` to trigger the state.

---

## Selector Strategy

Use in this order:
1. `[data-testid="pricing"]` — best
2. `section.pricing` — good
3. `#hero` — good if exists
4. `header`, `nav`, `footer` — for landmarks
5. `.card` — ok, might not be unique

Find selectors with `page_outline()` — it shows the best available selector for each section.

---

## interact Examples

```
interact({ action: "click", selector: ".btn" })
interact({ action: "type", selector: "#email", text: "user@test.com" })
interact({ action: "scroll", direction: "down", amount: 500 })
interact({ action: "hover", selector: ".menu-item" })
interact({ action: "select", selector: "#plan", value: "pro" })
interact({ action: "press_key", text: "Enter" })
```

Each action returns a screenshot automatically.

---

## Tips
- No need to pass `url` — Glimpse auto-detects your dev server.
- `smart_diff` > `pixel_diff` — it tells you WHAT changed, not just WHERE.
- Baselines persist between sessions.
- Use `dom_inspect` before changing styles — know the current values first.
