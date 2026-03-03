# Testing Patterns

**Analysis Date:** 2026-03-03

## Test Framework

**Runner:**
- WebdriverIO (wdio) with Mocha framework
- E2E tests only (no unit tests in the project)
- Config: `/Users/ryanbrown/code/obsidian-diff-viewer/e2e/wdio.conf.ts`

**Assertion Library:**
- Jest matchers (expect syntax)
- Mocha BDD syntax (describe, it, beforeEach)

**Run Commands:**
```bash
cd e2e && npx wdio run ./wdio.conf.ts      # Run all E2E tests
cd e2e && npx wdio run ./wdio.conf.ts --mochaOpts.grep "test name"  # Run single test
```

**Environment:**
- Test vault: `.e2e_test_vault` directory (created fresh for each test suite)
- Obsidian binary: `/Applications/Obsidian.app/Contents/MacOS/Obsidian`
- Browser: Electron (37.10.2)
- Timeout: 60 seconds per test (10 days in debug mode via `DEBUG` env var)

## Test File Organization

**Location:**
- E2E specs: `/Users/ryanbrown/code/obsidian-diff-viewer/e2e/test/specs/`
- Page objects: `/Users/ryanbrown/code/obsidian-diff-viewer/e2e/test/pageobjects/`
- Type definitions: `/Users/ryanbrown/code/obsidian-diff-viewer/e2e/test/types/`

**Naming:**
- Test files: `*.e2e.ts` (e.g., `external-change.e2e.ts`)
- Page object classes: PascalCase (e.g., `ObsidianApp`)

**Structure:**
```
e2e/
├── test/
│   ├── specs/
│   │   └── external-change.e2e.ts       # Feature tests
│   ├── pageobjects/
│   │   └── ObsidianApp.ts              # Page object helper
│   └── types/
│       └── obsidian.d.ts               # Type stubs for global
├── wdio.conf.ts                         # WebdriverIO config
└── package.json                         # Test dependencies
```

## Test Structure

**Suite Organization:**
```typescript
describe("External diff viewer", () => {
  beforeEach(async () => {
    await ObsidianApp.closeDiffTabs();  // Clean state between tests
  });

  it("should open diff tab when a file is modified externally", async () => {
    // Test body
  });
});
```

**Patterns:**
- `beforeEach`: Clean test state (close diff tabs, clear pending diffs)
- `beforeSuite` in wdio.conf: Fresh vault creation, plugin activation
- No afterEach cleanup needed; vault destroyed between suite runs

**Global Setup (wdio.conf.ts):**
```typescript
beforeSuite: async () => {
    await ObsidianApp.removeE2eTestVaultIfExists();
    await ObsidianApp.createAndOpenFreshVault();
    await ObsidianApp.activateTargetPluginForTesting();
},
```

## Mocking

**Framework:** No explicit mocking library used

**Patterns:**
- File system operations via `fs/promises` directly for external file modification
- `browser.execute()` for Obsidian API access (runs in Electron context)
- Page objects abstract browser interactions via `$()` selectors and `.click()`, `.getValue()`, etc.

**Browser Execute Pattern:**
```typescript
await browser.execute((text: string, pluginId: string) => {
  declare const app: any;  // @ts-expect-error
  const file = app.workspace.getActiveFile()!;
  const plugin = app.plugins.plugins[pluginId] as any;
  plugin.fileWatcher.markAsInternalEdit(file.path);
  await app.vault.modify(file, text);
}, content, PLUGIN_ID);
```

**What to Test:**
- External file modifications (direct fs.writeFile)
- User interactions (clicks, keyboard events)
- Plugin integration with Obsidian API
- Diff view UI rendering and state

**What NOT to Mock:**
- Obsidian app instance (use real app during E2E)
- File system (write real files to test vault)
- CodeMirror editor (interact with real DOM)
- Network (not applicable; local plugin)

## Fixtures and Test Data

**Test Data:**
- Inline string arrays for file content:
```typescript
const lines = Array.from({length: 20}, (_, i) => `line ${i + 1}`);
const modified = [...lines];
modified[0] = "CHANGED line 1";
await ObsidianApp.createNewNote(modified.join("\n"));
```

**Location:**
- No shared fixtures directory
- Test data created dynamically in test methods via `ObsidianApp.createNewNote()`

**Page Object Methods for Setup:**
- `createNewNote(content)`: Create file with initial content
- `modifyFileExternally(filePath, content)`: Write to fs directly
- `editFileInternally(filePath, content)`: Modify via Obsidian API
- `getDiffSections()`: Get all diff section elements for assertions

## Coverage

**Requirements:** No coverage enforcement configured

**View Coverage:**
- Not used for this E2E-only test suite

## Test Types

**Unit Tests:**
- Not present in codebase
- Complex algorithms (patienceDiff) not unit tested in isolation

**Integration Tests:**
- Not explicitly separated; all tests are E2E

**E2E Tests:**
- Framework: WebdriverIO with Mocha
- Scope: Full plugin lifecycle within Obsidian app
- 9 comprehensive tests in `external-change.e2e.ts`

**Test Suite Breakdown:**

1. **"should open diff tab when a file is modified externally"**
   - Creates note, modifies externally, waits for diff UI
   - Verifies one diff section appears

2. **"should NOT open diff tab for internal edits"**
   - Creates note via `createNewNote()` (internal edit)
   - Pauses 3 seconds, verifies no diff container

3. **"should remove diff section when Accept is clicked"**
   - Creates, modifies externally, clicks Accept
   - Verifies diff tab closes (auto-closes when empty)

4. **"should revert to old content when Reject is clicked"**
   - Creates, modifies externally, clicks Reject
   - Reads file from vault fs, verifies original content

5. **"should accumulate multiple files in a single diff tab"**
   - Creates two notes, modifies both externally
   - Verifies both appear in single diff tab

6. **"should expand collapsed unchanged lines and re-collapse them"**
   - Creates 20-line file, modifies first/last lines
   - Verifies fold regions appear/disappear on click

7. **"should accumulate sequential edits to the same file into one diff"**
   - Creates file, applies two external edits
   - Uses `browser.execute()` to read MergeView state
   - Verifies both changes accumulated in one diff

8. **"should only track external edits when interleaved with internal edits"**
   - External → Accept → Internal → External
   - Verifies snapshot baseline updates after internal edit
   - Complex state management test

9. **"should reopen diff tab with pending diffs via command"**
   - External change → Close tab → Reopen via command
   - Verifies pending diffs persist

## Common Patterns

**Async Testing:**
- All test methods are `async` and use `await`
- WebdriverIO promises return automatically resolved

```typescript
it("should open diff tab when a file is modified externally", async () => {
    await ObsidianApp.createNewNote("Hello world");
    const filePath = await ObsidianApp.getActiveFilePath();
    await ObsidianApp.modifyFileExternally(filePath, "Hello world - modified externally");
    await ObsidianApp.waitForDiffTab();
    const sections = await ObsidianApp.getDiffSections();
    expect(sections.length).toBe(1);
});
```

**Timing and Waits:**
- `browser.pause(ms)` for explicit delays (1000-3000ms common)
- `waitForExist({ timeout: 15000 })` for DOM element waits
- `browser.waitUntil()` for custom async conditions

**Example from test:**
```typescript
await ObsidianApp.waitForDiffTab();  // Waits for .diff-view-container
await browser.pause(1000);             // Explicit pause for vault settle
```

**Page Object Pattern:**
```typescript
class ObsidianApp {
  async waitForDiffTab() {
    await $(".diff-view-container").waitForExist({ timeout: 15000 });
  }

  async getDiffSections() {
    return $$(".diff-view-section");
  }

  async clickAccept(sectionIndex: number) {
    const sections = await this.getDiffSections();
    const btn = await sections[sectionIndex]!.$(".diff-view-btn-accept");
    await btn.scrollIntoView();
    await btn.click();
  }
}
```

**DOM Selectors:**
- CSS class selectors: `.diff-view-container`, `.diff-view-section`, `.diff-view-btn-accept`
- Aria labels: `aria/New note`
- WebdriverIO globals: `$()` for single element, `$$()` for multiple

**State Inspection via browser.execute():**
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
expect(diffContent).not.toBeNull();
expect(diffContent!.a).toBe(expectedOldContent);
```

## Test Data Utilities

**File Creation in Test Vault:**
- `ObsidianApp.createNewNote(content)`: Creates via Obsidian UI and calls `vault.modify()`
- `ObsidianApp.editFileInternally(filePath, content)`: Modifies via Obsidian API
- `ObsidianApp.modifyFileExternally(filePath, content)`: Direct fs.writeFile (simulates external tool)
- `ObsidianApp.readFileFromVault(filePath)`: Reads from fs for assertion

**Page Object Selector Library:**
```typescript
// Interaction helpers
await newNoteButton.click()
await noteContent.click()
await btn.scrollIntoView()

// State queries
await this.getDiffSections()
await this.getActiveFilePath()
await this.readFileFromVault(filePath)

// Waits
await $(".diff-view-container").waitForExist({ timeout: 15000 })
await browser.waitUntil(
  async () => (await this.getDiffSections()).length === count,
  { timeout: 10000 }
)
```

---

*Testing analysis: 2026-03-03*
