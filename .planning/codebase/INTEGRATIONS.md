# External Integrations

**Analysis Date:** 2026-03-03

## APIs & External Services

**Obsidian Vault API:**
- Vault file access and event monitoring
  - SDK/Client: `obsidian` package (latest)
  - Methods: `app.vault.modify()`, `app.vault.getMarkdownFiles()`, `app.vault.cachedRead()`, `app.vault.on("modify"|"create"|"delete"|"rename")`

**Obsidian Workspace API:**
- Workspace and editor event handling
  - SDK/Client: `obsidian` package
  - Methods: `app.workspace.on()`, `app.workspace.getLeavesOfType()`, `app.workspace.getLeaf()`, `app.workspace.onLayoutReady()`

**Obsidian Editor API:**
- Editor content manipulation and cursor control
  - SDK/Client: `obsidian` package
  - Methods: `editor.getValue()`, `editor.getCursor()`, `editor.getSelection()`, `editor.posToOffset()`

## Data Storage

**Databases:**
- None - No external database integration

**File Storage:**
- Local filesystem only - Files stored in Obsidian vault (managed by Obsidian API)
- Settings storage: Plugin data API via `plugin.loadData()` and `plugin.saveData()`
  - Location: Obsidian's local plugin storage
  - Client: Obsidian Plugin API

**Caching:**
- Obsidian vault caching system (built-in)
  - Used via `app.vault.cachedRead(file)` in `FileWatcher.ts`

## Authentication & Identity

**Auth Provider:**
- Custom - None required
- Implementation: Plugin runs in the context of Obsidian application with access to vault files

## File Monitoring

**Change Detection:**
- Obsidian vault event system
  - Events monitored: modify, create, delete, rename on vault files
  - Implementation: Event listeners registered in `src/main.ts`
  - Filtering: Only markdown files (`.md` extension) processed via `TFile.extension` check

**Debouncing:**
- Internal debouncing mechanism using `setTimeout()`
  - Debounce timers tracked in `FileWatcher.ts` (`debounceTimers` Map)
  - Configurable delay via settings (default: 1000ms)

## UI Components

**CodeMirror Integration:**
- CodeMirror 6 merge view for diff display
  - Package: `@codemirror/merge` (6.7.6)
  - Location: `src/DiffView.ts`
  - Components: MergeView, EditorView, EditorState, lineNumbers widget
  - Custom extensions: foldUnchangedExtension (in `src/foldUnchanged.ts`)

**Obsidian View System:**
- Custom ItemView integration
  - Implementation: `DiffView` extends `ItemView` from obsidian package
  - View type ID: `"external-diff-view"`
  - Location: `src/DiffView.ts`

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- No external logging - Development is via console (standard browser console in Obsidian)

## Webhooks & Callbacks

**Incoming:**
- None - Plugin is event-driven only

**Outgoing:**
- Plugin callbacks:
  - `onExternalChange` callback from FileWatcher to main plugin for handling external file modifications
  - `onAccept` callback - User accepts external changes, updates vault file
  - `onReject` callback - User rejects external changes, reverts to original content
  - All callbacks defined in `src/main.ts` in the `makeDiffCallbacks()` method

## Settings Persistence

**Storage:**
- Obsidian plugin data API
- Settings interface: `ExternalDiffSettings` (in `src/settings.ts`)
- Persisted settings:
  - `enabled` (boolean) - Toggle external change detection on/off
  - `debounceMs` (number) - Millisecond delay for debouncing file change detection

**Settings UI:**
- Obsidian Settings Tab via `PluginSettingTab`
- Location: `src/settings.ts` (`ExternalDiffSettingTab` class)

## Plugin Lifecycle

**Initialization:**
- `plugin.onload()` - Triggered when Obsidian loads the plugin
  - Loads settings
  - Registers diff view type
  - Registers vault event listeners
  - Registers commands
  - Adds settings tab

**Cleanup:**
- `plugin.onunload()` - Triggered when Obsidian unloads the plugin
  - Calls `fileWatcher.destroy()` to clean up resources

## Commands Registered

**User-Facing Commands:**
- `toggle-external-change-detection` - Toggle monitoring on/off
- `open-diff-viewer` - Open or focus the diff viewer tab

**Test Commands:**
- `test-simulate-insert` - Simulate external text insertion for testing
- `test-simulate-delete` - Simulate external text deletion for testing

---

*Integration audit: 2026-03-03*
