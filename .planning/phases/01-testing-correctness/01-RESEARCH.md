# Phase 1: Testing & Correctness - Research

**Researched:** 2026-03-03
**Domain:** WebdriverIO E2E testing for Obsidian/CodeMirror 6 plugin
**Confidence:** HIGH

## Summary

Phase 1 is about hardening the existing test suite and committing the side-swap fix. The codebase already has 9 E2E tests using WebdriverIO + Mocha + Electron targeting a real Obsidian app. The existing infrastructure (page objects, vault setup, browser.execute patterns) is solid and well-structured. The gaps are specific: tests don't verify content direction on accept, per-chunk revert controls aren't tested, reject-all content isn't verified, and fold sync assertions are present but don't verify cross-editor synchronization.

The uncommitted DiffView.ts fix swaps `oldContent`/`newContent` in MergeView sides A and B and renames the revert button tooltip from "Apply this change" to "Revert this change". This is a 3-line diff that corrects a semantically backwards assignment. Side A (editable, left) now gets `newContent`, Side B (read-only, right) gets `oldContent`. The `revertControls: "b-to-a"` direction means revert buttons copy chunks FROM old (B) TO new (A) -- reverting a change. This is correct.

**Primary recommendation:** Extend existing test patterns with targeted new tests and strengthen existing assertions. The page object and infrastructure need only minor additions (content verification helpers, revert-control interaction).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Extend existing test suite (9 tests already exist) with new tests for gaps
- Fix/strengthen existing tests where assertions are too weak (e.g., accept test doesn't verify content direction)
- New tests needed: per-chunk accept/reject (CM6 revert controls), reject-all content verification, accept-all content verification
- Deal with flaky/unreliable tests case-by-case based on manual verification results
- After automated tests pass, deploy plugin to vault and manually walk through scenarios
- Manual verification gate before proceeding to Phase 2
- If manual check reveals issues that tests missed, fix both the code and the tests
- Commit the existing uncommitted DiffView.ts changes (swaps old/new content sides, changes "Apply" to "Revert")
- Verify fix is correct via new TEST-01 (accept-all applies new content, not old)

### Claude's Discretion
- How to interact with CM6 revert control widgets in WebdriverIO (technical implementation detail)
- Test data content and structure
- Timing/wait strategies for test reliability

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TEST-01 | E2e tests confirm accept-all applies new content correctly (not reversed) | Strengthen existing accept test (#3) to read file from vault after accept and verify it contains the NEW content, not the old. Side-swap fix must be committed first. |
| TEST-02 | E2e tests confirm per-chunk accept and per-chunk reject work via revert controls | New test: create multi-change diff, click CM6 revert button on one chunk, accept-all, verify mixed content. Requires DOM interaction with `.diff-view-revert-btn` elements inside MergeView. |
| TEST-03 | E2e tests confirm external change detection opens diff view automatically | Already covered by existing test #1 ("should open diff tab when a file is modified externally"). Review for assertion completeness. |
| TEST-04 | E2e tests confirm fold/expand of unchanged regions syncs across both sides | Existing test #6 covers expand/collapse but doesn't verify BOTH editors sync. Strengthen by checking fold widget counts in BOTH `.cm-merge-a` and `.cm-merge-b` panels. |
| TEST-05 | E2e tests confirm accumulated diffs resolve correctly | Existing test #7 covers accumulation content. Strengthen by also accepting the accumulated diff and verifying the final file content matches the latest external edit. |
| TEST-06 | Commit the DiffView.ts side-swap fix with passing tests | 3-line diff swapping old/new in MergeView a/b and renaming tooltip. Commit after TEST-01 passes to prove fix is correct. |
| TEST-07 | E2e tests confirm reject-all restores original content correctly | Existing test #4 covers reject, but strengthen assertion: verify file content equals ORIGINAL content (pre-external-change), not just any specific string. Pattern already in place. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebdriverIO | 9.x | E2E test runner for Electron apps | Already in project, excellent Electron support |
| Mocha | via wdio | BDD test framework | Already configured in wdio.conf.ts |
| expect (jest) | via wdio | Assertion library | Already in project, expect-webdriverio |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @wdio/globals | 9.x | browser/$/$$ globals | All test files |
| fs/promises | Node built-in | Direct file I/O for external edits | ObsidianApp page object |

### Alternatives Considered
None -- the stack is locked by the existing test infrastructure.

## Architecture Patterns

### Existing Test Structure (DO NOT CHANGE)
```
e2e/
├── test/
│   ├── specs/
│   │   └── external-change.e2e.ts       # All tests in one suite
│   ├── pageobjects/
│   │   └── ObsidianApp.ts              # Page object singleton
│   └── types/
│       └── obsidian.d.ts               # Type stubs
├── wdio.conf.ts                         # Config with beforeSuite
└── package.json                         # Test dependencies
```

### Pattern 1: Content Verification After Action
**What:** After accept/reject, read file from vault and compare to expected content.
**When to use:** TEST-01, TEST-02, TEST-05, TEST-07
**Example:**
```typescript
// Accept, then verify vault file contains the expected content
await ObsidianApp.clickAccept(0);
await browser.pause(2000);
const content = await ObsidianApp.readFileFromVault(filePath);
expect(content).toBe(expectedNewContent);
```

### Pattern 2: CM6 Revert Control Interaction (Per-Chunk)
**What:** Click the revert buttons rendered by CodeMirror MergeView's `revertControls` to selectively undo individual chunks before accepting.
**When to use:** TEST-02
**Key insight:** MergeView with `revertControls: "b-to-a"` renders buttons (`.diff-view-revert-btn`) between chunk gaps. Clicking a revert button copies that chunk from B (old) into A (new), effectively undoing that one change. After reverting some chunks, clicking Accept reads the full A editor content -- a mix of new and reverted-to-old.

**DOM structure:** Revert buttons are rendered inside the MergeView DOM, within `.cm-merge-revert` containers placed between the two editors. They are NOT inside standard `.diff-view-section` elements. The selector path is:
```
.diff-view-merge .cm-merge-revert .diff-view-revert-btn
```

**Example:**
```typescript
// Wait for revert buttons to be present
const revertBtns = await $$(".diff-view-revert-btn");
expect(revertBtns.length).toBeGreaterThan(0);

// Click the first revert button (reverts one chunk from old to new)
await revertBtns[0]!.scrollIntoView();
await revertBtns[0]!.click();
await browser.pause(500);

// Now accept -- content will be a mix: reverted chunk has old content, rest has new
await ObsidianApp.clickAccept(0);
await browser.pause(2000);
const content = await ObsidianApp.readFileFromVault(filePath);
// Verify the specific mixed content
```

### Pattern 3: Fold Sync Verification Across Editors
**What:** After clicking a fold widget, verify fold state in BOTH `.cm-merge-a` and `.cm-merge-b` panels.
**When to use:** TEST-04
**Example:**
```typescript
// Check fold widgets in BOTH editors
const foldsA = await $$(".cm-merge-a .diff-view-fold-widget:not(.diff-view-fold-expanded)");
const foldsB = await $$(".cm-merge-b .diff-view-fold-widget:not(.diff-view-fold-expanded)");
expect(foldsA.length).toBe(foldsB.length); // Must be in sync
```

### Pattern 4: MergeView State Inspection via browser.execute
**What:** Read editor content from MergeView.a and MergeView.b programmatically.
**When to use:** When DOM text isn't reliable (folded content invisible in DOM).
**Example (already in codebase):**
```typescript
const diffContent = await browser.execute(() => {
  declare const app: any;
  const leaves = app.workspace.getLeavesOfType("external-diff-view");
  if (!leaves.length) return null;
  const view = leaves[0].view as any;
  const section = view.sections.values().next().value;
  if (!section?.mergeView) return null;
  return {
    a: section.mergeView.a.state.doc.toString(),
    b: section.mergeView.b.state.doc.toString(),
  };
});
```

### Anti-Patterns to Avoid
- **Asserting only DOM structure without content:** Tests that only check `sections.length === 1` without verifying WHAT content is in the diff are insufficient (this is the current gap).
- **Hardcoded pause instead of waitUntil:** Use `browser.waitUntil()` for conditions that have observable signals. Reserve `browser.pause()` only for "let Obsidian settle" after write operations where there's no DOM signal.
- **Testing the same thing twice:** TEST-03 (external change opens diff) is already well-covered by test #1. Don't duplicate -- just review it for completeness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-chunk accept/reject | Custom chunk tracking | CM6 MergeView `revertControls` | Already renders revert buttons; clicking them modifies editor A. Just click the DOM buttons in tests. |
| Content direction verification | Manual editor inspection | `readFileFromVault()` after accept/reject | Filesystem is the source of truth, not DOM state |
| Fold sync testing | Custom fold state tracking | Count `.diff-view-fold-widget` in each `.cm-merge-a` / `.cm-merge-b` | DOM reflects fold state accurately |

## Common Pitfalls

### Pitfall 1: Revert Buttons Swallowed by CM6 Widget ignoreEvent
**What goes wrong:** CM6 widgets return `true` from `ignoreEvent` for MouseEvent by default, which can prevent click handlers from firing through `domEventHandlers`.
**Why it happens:** MergeView's revert control buttons are rendered as CM6 widgets.
**How to avoid:** The plugin uses `renderRevertControl` which creates standard DOM buttons with their own click handlers registered by MergeView internally -- these should work fine. Test by clicking the `.diff-view-revert-btn` element directly. If clicks don't register, use `browser.execute()` to click programmatically.
**Warning signs:** Revert button click has no effect; editor A content unchanged after click.

### Pitfall 2: Side A vs Side B Confusion After Fix
**What goes wrong:** Tests assert wrong content on wrong side because the mental model of A/B is backwards.
**Why it happens:** The side-swap fix changed semantics. After fix: A = new (editable, left), B = old (read-only, right).
**How to avoid:** Always remember: Accept reads A (the new content, possibly with reverts applied). Reject calls `onReject()` which restores old content from snapshot. `revertControls: "b-to-a"` copies from old (B) into new (A).
**Warning signs:** `diffContent.a` contains old content when it should contain new.

### Pitfall 3: Timing Between External Write and Diff Appearance
**What goes wrong:** Test reads diff state before Obsidian's file watcher fires and MergeView renders.
**Why it happens:** `fs.writeFile` is async, Obsidian's vault watcher has its own polling/debounce, and MergeView creation is synchronous but triggered by an event chain.
**How to avoid:** Always `await ObsidianApp.waitForDiffTab()` after `modifyFileExternally()`. For content assertions, add `browser.pause(1000)` after waitForDiffTab to let MergeView finish rendering.
**Warning signs:** `sections.length === 0` or `diffContent === null` intermittently.

### Pitfall 4: Accept Content After Partial Revert
**What goes wrong:** After clicking revert on a chunk, the Accept button reads from editor A which now has mixed content. If the test doesn't account for the exact mixed state, assertions fail.
**Why it happens:** Revert modifies editor A in-place. The resulting content depends on which chunks were reverted and which weren't.
**How to avoid:** Use deterministic test data with clearly distinct chunks. Verify the exact expected mixed content string.
**Warning signs:** Content has unexpected line ordering after partial revert.

### Pitfall 5: Fold Widget Selectors Across Editors
**What goes wrong:** `$$(".diff-view-fold-widget")` returns widgets from BOTH editors combined, making count-based assertions unreliable.
**Why it happens:** Both `.cm-merge-a` and `.cm-merge-b` contain fold widgets.
**How to avoid:** Scope selectors: `$$(".cm-merge-a .diff-view-fold-widget")` and `$$(".cm-merge-b .diff-view-fold-widget")` separately.
**Warning signs:** Fold widget count is double what expected.

## Code Examples

### Strengthened Accept Test (TEST-01)
```typescript
it("should apply NEW content when Accept is clicked", async () => {
  const originalContent = "Original content before external change";
  await ObsidianApp.createNewNote(originalContent);
  const filePath = await ObsidianApp.getActiveFilePath();

  const externalContent = "New content from external tool";
  await ObsidianApp.modifyFileExternally(filePath, externalContent);
  await ObsidianApp.waitForDiffTab();

  await ObsidianApp.clickAccept(0);
  await browser.pause(2000);

  const fileContent = await ObsidianApp.readFileFromVault(filePath);
  expect(fileContent).toBe(externalContent); // NEW content, not original
});
```

### Per-Chunk Revert Test (TEST-02)
```typescript
it("should allow per-chunk revert via revert controls", async () => {
  // Create content with two distinct change regions
  const original = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  await ObsidianApp.createNewNote(original.join("\n"));
  const filePath = await ObsidianApp.getActiveFilePath();

  // Modify first and last lines (two separate chunks)
  const modified = [...original];
  modified[0] = "ALPHA";   // chunk 1: line 1 changed
  modified[7] = "THETA";   // chunk 2: line 8 changed
  await ObsidianApp.modifyFileExternally(filePath, modified.join("\n"));
  await ObsidianApp.waitForDiffTab();

  // Find and click the first revert button (reverts chunk 1 back to "alpha")
  const revertBtns = await $$(".diff-view-revert-btn");
  expect(revertBtns.length).toBeGreaterThanOrEqual(2);
  await revertBtns[0]!.scrollIntoView();
  await revertBtns[0]!.click();
  await browser.pause(500);

  // Accept the mixed state: chunk 1 reverted (alpha), chunk 2 kept (THETA)
  await ObsidianApp.clickAccept(0);
  await browser.pause(2000);

  const expected = [...original];
  expected[7] = "THETA"; // only chunk 2's change survives
  const content = await ObsidianApp.readFileFromVault(filePath);
  expect(content).toBe(expected.join("\n"));
});
```

### Fold Sync Verification (TEST-04)
```typescript
// After expanding a fold widget, verify both sides updated
const foldsA_before = await $$(".cm-merge-a .diff-view-fold-widget:not(.diff-view-fold-expanded)");
const foldsB_before = await $$(".cm-merge-b .diff-view-fold-widget:not(.diff-view-fold-expanded)");
expect(foldsA_before.length).toBe(foldsB_before.length);

// Click fold in side A
await foldsA_before[0]!.click();
await browser.pause(500);

// Verify BOTH sides have one fewer fold
const foldsA_after = await $$(".cm-merge-a .diff-view-fold-widget:not(.diff-view-fold-expanded)");
const foldsB_after = await $$(".cm-merge-b .diff-view-fold-widget:not(.diff-view-fold-expanded)");
expect(foldsA_after.length).toBe(foldsA_before.length - 1);
expect(foldsB_after.length).toBe(foldsB_before.length - 1);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A = old, B = new | A = new (editable), B = old (read-only) | Side-swap fix (uncommitted) | Accept reads A which is new content; revert copies B-to-A (old into new) |
| "Apply this change" tooltip | "Revert this change" tooltip | Side-swap fix (uncommitted) | Semantically correct: clicking revert button undoes a change |

## Open Questions

1. **Revert button clickability in WebdriverIO**
   - What we know: CM6 MergeView renders revert buttons via `renderRevertControl`. The custom renderer creates standard `<button>` elements. MergeView registers its own click handler internally.
   - What's unclear: Whether WebdriverIO's `click()` on these elements will trigger the MergeView revert action reliably, or if CM6's event handling will interfere.
   - Recommendation: Try direct click first. If it doesn't work, fall back to `browser.execute()` to programmatically dispatch a click event on the button, or access MergeView's `acceptChunk` API directly.

2. **Exact DOM structure of revert buttons**
   - What we know: `renderRevertControl` returns a button with class `diff-view-revert-btn`. MergeView places these in `.cm-merge-revert` wrappers.
   - What's unclear: Exact nesting and whether buttons are inside shadow DOM or standard DOM.
   - Recommendation: Inspect DOM during first test run. Adjust selectors if needed. CM6 does not use shadow DOM.

3. **Fold widget scoping with .cm-merge-a / .cm-merge-b**
   - What we know: MergeView adds `cm-merge-a` and `cm-merge-b` classes to the two editor root elements.
   - What's unclear: Whether these classes are on the outermost wrapper or on the `.cm-editor` elements. Selector scoping depends on this.
   - Recommendation: Inspect DOM during test development. The fold widgets (`.diff-view-fold-widget`) are custom widgets created in `foldUnchanged.ts` and rendered inside each editor.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | WebdriverIO 9.x + Mocha |
| Config file | `e2e/wdio.conf.ts` |
| Quick run command | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "TEST_NAME"` |
| Full suite command | `cd e2e && npx wdio run ./wdio.conf.ts` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | Accept-all applies new content | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "apply NEW content"` | Existing test #3 needs strengthening |
| TEST-02 | Per-chunk accept/reject via revert controls | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "per-chunk revert"` | New test needed |
| TEST-03 | External change opens diff view | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "open diff tab when"` | Existing test #1 (review only) |
| TEST-04 | Fold/expand syncs both sides | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "expand collapsed"` | Existing test #6 needs strengthening |
| TEST-05 | Accumulated diffs resolve correctly | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "accumulate sequential"` | Existing test #7 needs accept+verify |
| TEST-06 | Commit side-swap fix | manual + e2e | Full suite after commit | N/A (commit task) |
| TEST-07 | Reject-all restores original content | e2e | `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "revert to old content"` | Existing test #4 (review assertions) |

### Sampling Rate
- **Per task commit:** `cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "RELEVANT_TEST"`
- **Per wave merge:** `cd e2e && npx wdio run ./wdio.conf.ts`
- **Phase gate:** Full suite green + manual verification before Phase 2

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. No new framework install, config, or fixture files needed. Only test code additions/modifications within `e2e/test/specs/external-change.e2e.ts` and minor page object additions in `e2e/test/pageobjects/ObsidianApp.ts`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/DiffView.ts` -- MergeView configuration, revertControls setup, handleAccept/handleReject logic
- Codebase analysis: `e2e/test/specs/external-change.e2e.ts` -- all 9 existing tests reviewed
- Codebase analysis: `e2e/test/pageobjects/ObsidianApp.ts` -- full page object API reviewed
- Codebase analysis: `git diff src/DiffView.ts` -- exact side-swap changes confirmed (3 lines)
- `.planning/codebase/TESTING.md` -- test framework documentation
- `.planning/codebase/ARCHITECTURE.md` -- data flow and state management
- `.planning/codebase/CONCERNS.md` -- known issues and fragile areas
- CLAUDE.md memory: CM6 widget click handling via `addEventListener` in `toDOM()`, Facet pattern

### Secondary (MEDIUM confidence)
- CodeMirror MergeView `revertControls` behavior: Based on codebase usage (`revertControls: "b-to-a"`, `renderRevertControl`) and CM6 documentation knowledge. Revert direction and button rendering confirmed from source code.

### Tertiary (LOW confidence)
- Exact DOM selector paths for revert buttons (`.cm-merge-revert`) and editor scoping (`.cm-merge-a`, `.cm-merge-b`) -- these are standard CM6 MergeView class names but should be verified during implementation by inspecting the DOM.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in project and working
- Architecture: HIGH - extending established patterns, no new infrastructure
- Pitfalls: HIGH for timing/content issues (from codebase analysis), MEDIUM for CM6 widget interaction specifics
- Test mapping: HIGH - each requirement maps to a clear test modification or addition

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable -- no expected framework changes)
