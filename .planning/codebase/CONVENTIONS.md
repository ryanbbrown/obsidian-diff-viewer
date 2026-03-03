# Coding Conventions

**Analysis Date:** 2026-03-03

## Naming Patterns

**Files:**
- PascalCase for classes/modules: `DiffView.ts`, `FileWatcher.ts`, `ExternalDiffPlugin` (main.ts)
- camelCase for utilities and functions: `patienceDiff.ts`, `foldUnchanged.ts`, `settings.ts`

**Classes:**
- PascalCase: `ExternalDiffPlugin`, `FileWatcher`, `DiffView`, `ExternalDiffSettingTab`

**Functions:**
- camelCase for public and private functions: `patienceDiff()`, `lineDiff()`, `computeUnchangedRanges()`, `handleModify()`, `createMergeView()`
- Private methods with underscore prefix pattern NOT used; instead use private keyword visibility

**Interfaces/Types:**
- PascalCase: `PendingDiff`, `FileSection`, `ExternalDiffSettings`, `DiffEntry`, `DiffResult`

**Constants:**
- UPPER_SNAKE_CASE for exported constants: `DIFF_VIEW_TYPE`, `DEFAULT_SETTINGS`
- camelCase for local constants: `TEST_VAULT_DIR`, `PLUGIN_ID` (module-level constants use camelCase)

**Variables:**
- camelCase: `oldContent`, `newContent`, `filePath`, `sections`, `mergeView`
- Private class fields with private keyword: `private fileWatcher`, `private snapshots`, `private pendingDiffs`

## Code Style

**Formatting:**
- Tool: None explicitly configured; uses TypeScript/ESLint defaults
- Indentation: Tabs (4 spaces equivalent per .editorconfig)
- Charset: UTF-8
- Line endings: LF
- Final newline: Enabled

**Linting:**
- Tool: ESLint 9.30.1 with typescript-eslint 8.35.1
- Config file: `eslint.config.mts` (flat config format)
- Rules source: `eslint-plugin-obsidianmd` 0.1.9 for Obsidian-specific rules
- Enforces: Strict TypeScript checking (strict: true in tsconfig)

**TypeScript Configuration:**
- Target: ES6
- Module: ESNext
- Strict mode enabled: `noImplicitAny`, `strictNullChecks`, `strictBindCallApply`, `noImplicitReturns`, `noUncheckedIndexedAccess`
- Inline source maps in development build

## Import Organization

**Order:**
1. External packages (obsidian, @codemirror/*)
2. Local modules with relative paths (./settings, ./patienceDiff)
3. Type-only imports use `import type` keyword

**Example from `src/main.ts`:**
```typescript
import {Editor, MarkdownView, Modal, Plugin, Setting} from "obsidian";
import {DEFAULT_SETTINGS, ExternalDiffSettings, ExternalDiffSettingTab} from "./settings";
import {FileWatcher} from "./FileWatcher";
import {DiffView, DIFF_VIEW_TYPE, PendingDiff} from "./DiffView";
```

**Type imports:**
```typescript
import type {ExternalDiffSettings} from "./settings";
import type {App} from "obsidian";
```

**Path Aliases:**
- `baseUrl: "src"` configured in tsconfig.json but used minimally; relative imports preferred in this small codebase

## Error Handling

**Patterns:**
- Early returns for guard clauses: `if (!(file instanceof TFile)) return;`
- Type guards with `instanceof` checks for safety
- No explicit try-catch blocks in main code; Obsidian API handles most errors
- Null checks before operations: `if (!view.file) return;`
- Non-null assertions with `!` used when type system doesn't infer: `aLines[i]!`, `bLines[bIndex]!`
- Manual state validation in diff callbacks with existence checks

**Example from `src/FileWatcher.ts`:**
```typescript
handleModify = async (file: TAbstractFile): Promise<void> => {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (!this.settings.enabled) return;
    // ... rest of logic
};
```

## Logging

**Framework:** No dedicated logging library; uses `console` methods directly

**Patterns:**
- `console.log()` in e2e tests: `console.log('Closing \\'${modalName}\\'');`
- No logging in main plugin code; minimal observability requirements for this domain

## Comments

**When to Comment:**
- Algorithm explanations for complex logic (patienceDiff.ts, foldUnchanged.ts)
- State tracking logic in FileWatcher (debounce, snapshot management)
- Conditional logic needing context (why certain checks are needed)

**JSDoc/TSDoc:**
- Single-line docstrings for public functions and methods: `/** Description of function */`
- Used consistently: `/** Render the modal with a text input and submit button. */`
- No @param/@returns annotations; keep concise

**Examples:**
```typescript
/** Line-based diff using patience algorithm, converted to CodeMirror Change[] with character offsets. */
function lineDiff(a: string, b: string): readonly Change[] { ... }

/** Find the existing diff view, or null if none open. */
private getExistingDiffView(): DiffView | null { ... }

/** Accept current state of editor A (includes any partial chunk reverts). */
private handleAccept(path: string): void { ... }
```

## Function Design

**Size:** Typically 5-40 lines for business logic; class methods 10-50 lines

**Parameters:**
- Single object parameter for related values: None used currently; individual params favored
- Callbacks passed as function parameters: `onExternalChange: (path: string, oldContent: string, newContent: string) => void`

**Return Values:**
- Explicit Promise types: `Promise<void>`, `Promise<string>`
- Type narrowing with readonly types: `readonly Change[]`
- Null for absence: `DiffView | null`
- Never implicit undefined; always explicit or void

## Module Design

**Exports:**
- Named exports for classes and functions
- `export` keyword on declaration: `export class DiffView`, `export function patienceDiff()`
- Default exports rare; only used in `export default class ExternalDiffPlugin`
- Interfaces exported when used across modules: `export interface PendingDiff`

**Barrel Files:**
- Not used; each module directly imported where needed

**Class Structure Pattern:**
```typescript
export class ClassName {
    // Public properties
    public property: Type;

    // Private properties
    private field: Type;

    // Constructor
    constructor(...) {}

    // Lifecycle methods
    async onload() {}
    onunload() {}

    // Public methods
    public method() {}

    // Private methods
    private privateMethod() {}
}
```

## Async/Await

**Pattern:**
- `async` functions return Promise types
- `await` used for sequential operations
- No explicit Promise chaining; uses async/await throughout
- `.then()` used only in callbacks where necessary: `this.openDiffTab().then(view => view.addFile(path, diff));`

**Example from `src/main.ts`:**
```typescript
private async openDiffTab(): Promise<DiffView> {
    const existing = this.getExistingDiffView();
    if (existing) {
        this.app.workspace.revealLeaf(existing.leaf);
        return existing;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({type: DIFF_VIEW_TYPE, active: true});
    const view = leaf.view as DiffView;
    // ...
    return view;
}
```

## Class Initialization

**Constructor Pattern:**
- Dependency injection via constructor parameters
- All required dependencies passed in; no lazy initialization
- Type declarations for parameters: `app: App`, `settings: ExternalDiffSettings`

**Example:**
```typescript
constructor(
    app: App,
    settings: ExternalDiffSettings,
    onExternalChange: (path: string, oldContent: string, newContent: string) => void,
) {
    this.app = app;
    this.settings = settings;
    this.onExternalChange = onExternalChange;
}
```

---

*Convention analysis: 2026-03-03*
