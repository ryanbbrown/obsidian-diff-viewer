# Phase 1: Testing & Correctness - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify all existing diff viewer functionality with comprehensive e2e tests and commit the DiffView.ts side-swap fix. No new features — only testing and fixing what exists.

</domain>

<decisions>
## Implementation Decisions

### Test strategy
- Extend existing test suite (9 tests already exist) with new tests for gaps
- Fix/strengthen existing tests where assertions are too weak (e.g., accept test doesn't verify content direction)
- New tests needed: per-chunk accept/reject (CM6 revert controls), reject-all content verification, accept-all content verification
- Deal with flaky/unreliable tests case-by-case based on manual verification results

### Verification approach
- After automated tests pass, deploy plugin to vault and manually walk through scenarios
- Manual verification gate before proceeding to Phase 2
- If manual check reveals issues that tests missed, fix both the code and the tests

### Side-swap fix
- Commit the existing uncommitted DiffView.ts changes (swaps old/new content sides, changes "Apply" to "Revert")
- Verify fix is correct via new TEST-01 (accept-all applies new content, not old)

### Claude's Discretion
- How to interact with CM6 revert control widgets in WebdriverIO (technical implementation detail)
- Test data content and structure
- Timing/wait strategies for test reliability

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ObsidianApp` page object: full set of helpers (createNewNote, modifyFileExternally, editFileInternally, getDiffSections, clickAccept, waitForDiffTab, readFileFromVault)
- `browser.execute()` pattern for accessing Obsidian API and MergeView state from tests
- Existing test data generation pattern: inline string arrays with `Array.from({length: N}, ...)`

### Established Patterns
- All tests use async/await with WebdriverIO promises
- `beforeEach` closes diff tabs for clean state
- `beforeSuite` creates fresh vault and activates plugin
- DOM selectors: `.diff-view-container`, `.diff-view-section`, `.diff-view-btn-accept`
- State inspection via `browser.execute()` to read MergeView editor content

### Integration Points
- Tests interact with real Obsidian app via Electron WebDriver
- File modifications via direct `fs.writeFile` to simulate external changes
- Plugin API access via `app.plugins.plugins[pluginId]` in browser.execute

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: tests must be trustworthy enough that passing tests = working functionality.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-testing-correctness*
*Context gathered: 2026-03-03*
