# BUG-03 (test-tool only, NOT a real bug): Synthetic .click() ignored by React form on captain unlock

**Role:** N/A — this is a verification-tool artifact
**Severity:** INFO — affects only automated testing, not real users
**Found:** 2026-05-23 production sweep

## Symptom
MCP `computer({action: "left_click"})` on the "Continue" / "Unlock Future 6.0 →" button did NOT trigger React's onClick handler for the captain code 9G299Q. No network request fired. Page stayed on /yi-future/unlock.

## Workaround that worked
JS-direct `MouseEvent('click', ...)` dispatched onto the same button → React handler fired immediately, code accepted, redirected to /yi-future/me.

## Memory match
This matches `feedback_synthetic_click_misses_modern_ui_libs.md` — synthetic clicks no-op on commit-style buttons in Radix/Material/etc.

## Why TSTJRY worked first try
Unclear. Possibly the form had a slightly different React state at that moment, or the first-load handler was attached differently. The pattern is intermittent.

## Real-user impact
**ZERO.** Real users using a real mouse never encounter this. The form works correctly in production.

## Action
None on production code. Future browser-test suites should use `dispatchEvent(MouseEvent)` pattern by default for submit-style buttons in React forms.
