---
name: a11y-audit
description: Audit pages or components for WCAG 2.2 AA issues with axe and scripted checks for the criteria axe misses. Use when the user asks for an accessibility audit or check of a site, page, or component.
argument-hint: "<URL, route, or component>"
---

# Accessibility audit

1. **Target.** Use the URL or route in `$ARGUMENTS`; start the project's dev server or use a preview deployment if needed (check for a running server first).
2. **Automated pass.** Run axe through Playwright with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` and the `target-size` rule enabled. See `practices/web-verification.md` in rules-for-robots for the snippet.
3. **Scripted checks for what axe misses.** Tab through the page and confirm each focused element is visible and not covered by sticky content (2.4.11); confirm drag interactions have a click alternative (2.5.7); paste into credential fields (3.3.8); check visible focus throughout.
4. **Judgement checks.** Review axe's `incomplete` results, reading order, heading structure, link text, form error messages, and motion.
5. **Report** issues grouped by WCAG criterion with the element, the failure, and the fix. Note that automated tools cover only part of WCAG, and list what still needs a manual or assistive-technology check.
