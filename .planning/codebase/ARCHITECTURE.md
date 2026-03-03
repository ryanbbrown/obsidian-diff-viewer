# Architecture

**Analysis Date:** 2026-03-03

## Pattern Overview

**Overall:** Plugin-based Obsidian extension with event-driven diff detection and resolution workflow

**Key Characteristics:**
- Event-driven file change detection with debouncing and state tracking
- Custom diff algorithm (Patience Diff) with specialized CodeMirror 6 integration
- Stateful diff view management with fold/expand controls for unchanged regions
- Separation of concerns: file monitoring, diff computation, UI rendering, and settings

## Layers

**Plugin Layer:**
- Purpose: Obsidian plugin lifecycle management, command registration, and orchestration
- Location: `src/main.ts`
- Contains: `ExternalDiffPlugin` class, command handlers, settings management
- Depends on: Obsidian API, FileWatcher, DiffView, settings
- Used by: Obsidian application

**File Watching Layer:**
- Purpose: Monitor vault changes and distinguish internal vs. external edits
- Location: `src/FileWatcher.ts`
- Contains: `FileWatcher` class for change detection with debouncing
- Depends on: Obsidian App/Vault API, settings
- Used by: Plugin layer to detect external changes

**Diff Computation Layer:**
- Purpose: Convert two text versions into structured diff representation
- Location: `src/patienceDiff.ts`, `src/DiffView.ts` (lineDiff function)
- Contains: Patience Diff algorithm, line-to-character offset conversion
- Depends on: None (pure algorithms)
- Used by: DiffView for change computation

**UI Rendering Layer:**
- Purpose: Display diffs with accept/reject controls and CodeMirror integration
- Location: `src/DiffView.ts`
- Contains: `DiffView` class extending ItemView, MergeView setup, fold extension integration
- Depends on: CodeMirror 6, Obsidian ItemView API, diff computation, fold system
- Used by: Obsidian workspace

**Fold System Layer:**
- Purpose: Collapse unchanged regions with synchronized toggle controls across dual editors
- Location: `src/foldUnchanged.ts`
- Contains: Custom CodeMirror state field, widgets, and decoration logic
- Depends on: CodeMirror state and view APIs
- Used by: DiffView for unchanged region visibility management

**Settings Layer:**
- Purpose: Manage plugin configuration (enabled state, debounce timing)
- Location: `src/settings.ts`
- Contains: `ExternalDiffSettings` interface, default settings, settings UI
- Depends on: Obsidian settings API
- Used by: Plugin and FileWatcher

## Data Flow

**External Change Detection and Resolution Flow:**

1. Vault modify event → FileWatcher.handleModify
2. FileWatcher compares snapshot vs. new content, checks internal edit markers
3. If external change detected → ExternalDiffPlugin.handleExternalChange
4. Plugin creates diff callbacks (onAccept/onReject) and stores in pendingDiffs map
5. If DiffView open → addFile; else → openDiffTab → addFile
6. DiffView.render builds UI with accept/reject buttons and file sections
7. DiffView.createMergeView initializes CodeMirror MergeView with Patience Diff
8. User clicks accept/reject → handleAccept/handleReject
9. Callback invokes onAccept/onReject → updates vault and snapshot
10. removeFile cleans up, closes tab if no pending diffs remain

**File Change Handling:**

- **Internal edit** (user typing in Obsidian): marked via `markAsInternalEdit`, debounced 1000ms
- **External change** (file modified outside): detected by snapshot mismatch, triggers diff workflow
- **Pending external**: tracked in `pendingExternalPaths` set; subsequent external changes accumulate
- **Resolved**: onAccept/onReject clears pending marker, updates snapshot

**State Management:**

- `ExternalDiffPlugin.pendingDiffs`: Map of path → PendingDiff (old/new content + callbacks)
- `DiffView.sections`: Map of path → FileSection (diff, expanded state, MergeView instance)
- `FileWatcher.snapshots`: Map of path → file content (last known state)
- `FileWatcher.recentlyEditedInternally`: Set of paths marked as internal edits (debounced)
- `FileWatcher.pendingExternalPaths`: Set of paths with unresolved external diffs

## Key Abstractions

**PendingDiff:**
- Purpose: Encapsulate a file change requiring resolution (old vs. new content + decision callbacks)
- Examples: `src/DiffView.ts` line 46-51, `src/main.ts` line 131-156
- Pattern: Plain interface with old/new content strings and onAccept/onReject callback functions

**FileWatcher:**
- Purpose: Abstract vault change detection, filter noise, and track editor state
- Examples: `src/FileWatcher.ts`
- Pattern: Event handler delegation with debouncing and snapshot comparison

**DiffView:**
- Purpose: Abstract multi-file diff display and CodeMirror integration
- Examples: `src/DiffView.ts` line 60
- Pattern: ItemView subclass managing FileSection map with render/createMergeView orchestration

**Fold System:**
- Purpose: Abstract unchanged region collapse/expand with state preservation and sync
- Examples: `src/foldUnchanged.ts` line 139-144, 147-185
- Pattern: CodeMirror StateField + custom WidgetType + Facet for cross-editor callbacks

**Patience Diff Algorithm:**
- Purpose: Compute human-intuitive line-based diffs by anchoring on unique lines
- Examples: `src/patienceDiff.ts` line 72
- Pattern: Recursive LCS with unique-line anchoring, avoids misalignment of blank/repeated lines

## Entry Points

**Plugin Initialization:**
- Location: `src/main.ts` line 11-93 (ExternalDiffPlugin.onload)
- Triggers: Obsidian plugin load lifecycle
- Responsibilities: Register view, commands, event listeners; initialize FileWatcher; load settings

**File Change Detection:**
- Location: `src/FileWatcher.ts` line 33-66 (handleModify)
- Triggers: Vault modify event
- Responsibilities: Compare snapshots, detect external vs. internal edits, trigger diff workflow

**Diff View Rendering:**
- Location: `src/DiffView.ts` line 81-83 (addFile), line 95-140 (render)
- Triggers: Plugin calls addFile after detecting external change
- Responsibilities: Build UI hierarchy, render file sections with accept/reject controls

**MergeView Creation:**
- Location: `src/DiffView.ts` line 143-195 (createMergeView)
- Triggers: File section expanded or DiffView created
- Responsibilities: Initialize CodeMirror MergeView, compute unchanged ranges, set up fold state

**Diff Computation:**
- Location: `src/DiffView.ts` line 9-42 (lineDiff)
- Triggers: CodeMirror MergeView diffConfig override
- Responsibilities: Convert Patience Diff result to CodeMirror Change[] with character offsets

## Error Handling

**Strategy:** Defensive null checks on optional values; graceful degradation; silent skip of non-markdown files

**Patterns:**
- Null/undefined checks before accessing file/editor: `if (!view.file) return;` (`src/main.ts`)
- Type guards: `if (!(file instanceof TFile))` filters non-file vault objects (`src/FileWatcher.ts`)
- Debounce timer cleanup on destroy prevents memory leaks (`src/FileWatcher.ts` line 125-133)
- MergeView destruction before re-render prevents dangling references (`src/DiffView.ts` line 96-100)

## Cross-Cutting Concerns

**Logging:** Not implemented; no logging framework present

**Validation:**
- Debounce input: parsed as integer, non-negative check in settings (`src/settings.ts` line 42-46)
- Content equality checks before processing changes (`src/FileWatcher.ts` line 40)
- File type filtering (markdown only via extension check)

**Authentication:** Not applicable (single-user Obsidian plugin)

---

*Architecture analysis: 2026-03-03*
