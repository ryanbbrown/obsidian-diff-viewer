# Codebase Structure

**Analysis Date:** 2026-03-03

## Directory Layout

```
obsidian-diff-viewer/
├── src/                    # TypeScript source files
│   ├── main.ts             # Plugin entry point, lifecycle, command registration
│   ├── DiffView.ts         # Diff view UI, CodeMirror MergeView integration
│   ├── FileWatcher.ts      # File change detection and state tracking
│   ├── foldUnchanged.ts    # Custom fold system for unchanged regions
│   ├── patienceDiff.ts     # Patience Diff algorithm implementation
│   └── settings.ts         # Plugin settings interface and UI
├── e2e/                    # End-to-end tests
│   ├── test/
│   │   ├── specs/          # Test specifications
│   │   ├── pageobjects/    # Page object models
│   │   └── types/          # TypeScript type definitions for tests
│   └── .e2e_test_vault/    # Test vault with plugin installed
├── .planning/              # GSD planning documents
├── main.js                 # Compiled plugin bundle
├── manifest.json           # Plugin metadata (version, name, ID)
├── styles.css              # Plugin UI styles
├── tsconfig.json           # TypeScript compiler configuration
├── package.json            # Dependencies and build scripts
├── esbuild.config.mjs      # ESM bundler configuration
└── eslint.config.mts       # ESLint configuration
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript source code for the plugin
- Contains: Plugin logic, UI components, algorithms, settings
- Key files: `main.ts`, `DiffView.ts`, `FileWatcher.ts`

**e2e/:**
- Purpose: End-to-end tests using WebdriverIO
- Contains: Test specs, page objects, test vault with plugin installed
- Key files: `e2e/test/specs/*.ts` (actual tests), `e2e/wdio.conf.ts` (test config)

**.planning/codebase/:**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Contains: Codebase mapping and guidance documents
- Committed: Yes, for CI/planning automation

## Key File Locations

**Entry Points:**
- `src/main.ts`: Plugin class definition and initialization (ExternalDiffPlugin)
- `main.js`: Bundled output, deployed to Obsidian vault plugin directory

**Configuration:**
- `manifest.json`: Plugin ID, version, Obsidian API version requirement
- `tsconfig.json`: TypeScript strict mode settings, ES6 target, source maps
- `esbuild.config.mjs`: Bundle entry (`src/main.ts`), output (`main.js`), external deps
- `eslint.config.mts`: ESLint rules for code quality

**Core Logic:**
- `src/FileWatcher.ts`: File change detection, snapshot management, debouncing
- `src/DiffView.ts`: Multi-file diff display, CodeMirror MergeView orchestration
- `src/patienceDiff.ts`: Patience Diff algorithm (pure, no side effects)
- `src/foldUnchanged.ts`: CodeMirror state field for fold/expand unchanged regions

**UI & Settings:**
- `src/settings.ts`: Plugin settings interface, defaults, settings tab UI
- `styles.css`: CSS for diff view layout, buttons, fold widgets, CodeMirror theme

**Testing:**
- `e2e/test/specs/`: WebdriverIO test files (*.ts)
- `e2e/.e2e_test_vault/.obsidian/plugins/obsidian-diff-viewer/`: Plugin directory in test vault
- `e2e/wdio.conf.ts`: Test runner configuration

## Naming Conventions

**Files:**
- `camelCase.ts`: Most source files (main.ts, DiffView.ts, FileWatcher.ts)
- `kebab-case.ts`: One exception: foldUnchanged.ts (internal naming style)
- Bundle output: `main.js` (Obsidian convention)
- Styles: `styles.css` (global scope)

**Directories:**
- `src/`: Source directory (TypeScript convention)
- `e2e/`: End-to-end tests directory
- `.planning/`: Hidden directory for planning artifacts (GSD convention)

**Classes:**
- `PascalCase`: ExternalDiffPlugin, DiffView, FileWatcher, TextInputModal, etc.

**Interfaces:**
- `PascalCase`: ExternalDiffSettings, PendingDiff, FileSection, FoldRange, etc.

**Functions:**
- `camelCase`: patienceDiff, lineDiff, foldUnchangedExtension, computeUnchangedRanges, etc.

**Constants:**
- `UPPER_SNAKE_CASE`: DIFF_VIEW_TYPE, DEFAULT_SETTINGS

## Where to Add New Code

**New Feature (e.g., UI enhancement, new command):**
- Primary code: `src/main.ts` (plugin commands), `src/DiffView.ts` (UI rendering)
- Styles: `src/styles.css`
- Tests: `e2e/test/specs/new-feature.spec.ts`

**New File Change Detection Strategy:**
- Implementation: Extend `src/FileWatcher.ts` methods (handleModify, etc.)
- Integration: Register event in ExternalDiffPlugin.onload (src/main.ts)

**New Diff Algorithm or Enhancement:**
- Implementation: `src/patienceDiff.ts` (pure algorithm) or new file if significantly different
- Integration: Update `lineDiff` function in `src/DiffView.ts` if changing Change[] format

**New Settings/Configuration:**
- Settings interface: `src/settings.ts` (ExternalDiffSettings)
- Settings UI: `src/settings.ts` (ExternalDiffSettingTab.display)
- Default values: `src/settings.ts` (DEFAULT_SETTINGS)
- Usage: `src/FileWatcher.ts`, `src/main.ts`

**Utilities/Helpers:**
- Shared utilities: Create new file in `src/` (e.g., `src/utils.ts`)
- Algorithm-specific: Own file (e.g., `src/patienceDiff.ts`)

**Tests:**
- Unit tests: Not present in repo (tests are E2E only)
- E2E tests: `e2e/test/specs/*.spec.ts`
- Page objects: `e2e/test/pageobjects/*.ts` for reusable Obsidian interaction patterns

## Special Directories

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)
- Key deps: @codemirror/merge, obsidian, esbuild, typescript, eslint

**.git/:**
- Purpose: Git version control metadata
- Generated: Yes (by git init)
- Committed: No (system directory)

**e2e/.e2e_test_vault/:**
- Purpose: Isolated Obsidian vault for E2E testing
- Generated: Partially (structure exists, plugin installed by tests)
- Committed: Yes (minimal vault structure, plugin symlinked/copied during test setup)

**dist/ (if present after build):**
- Purpose: Would contain compiled output (currently replaced by main.js)
- Generated: Yes (by esbuild)
- Committed: No (in .gitignore)

## File Organization Principles

**Import Patterns:**
- Obsidian API imports appear first: `import {App, MarkdownView, ...} from "obsidian"`
- External libs second: `import {Change, MergeView} from "@codemirror/merge"`
- Internal modules last: `import {FileWatcher} from "./FileWatcher"`

**Module Responsibility:**
- Each file has single primary export: `ExternalDiffPlugin`, `DiffView`, `FileWatcher`, etc.
- Interfaces/types co-located with implementation
- Helper functions remain in-module unless shared

**Plugin Structure:**
- Main plugin class extends Obsidian Plugin
- Event handlers use arrow functions to preserve `this` context
- Settings loaded in onload, settings tab added in onload
- Cleanup in onunload

---

*Structure analysis: 2026-03-03*
