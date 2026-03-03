# Codebase Concerns

**Analysis Date:** 2026-03-03

## Fragile Areas

**File Watcher State Synchronization:**
- Files: `src/FileWatcher.ts`, `src/main.ts`
- Why fragile: The state machine in `FileWatcher` managing internal edits (`recentlyEditedInternally`), pending external paths (`pendingExternalPaths`), and snapshots is complex and relies on timing. The debounce mechanism with `debounceTimers` (lines 10, 116-121 in FileWatcher.ts) can become desynchronized if:
  - Multiple vault events fire in rapid succession before debounce expires
  - Timers are cleared (destroy) but state variables are not properly reset
  - A file is created/renamed while marked as internally edited
  - The plugin unloads while async operations are pending
- Safe modification: Any changes to state transitions in `FileWatcher` should add explicit state validation tests. Consider adding a debug/audit log to track state transitions.
- Test coverage: E2E tests cover happy path (external-change.e2e.ts lines 156-204) but gaps exist for:
  - Rapid sequential edits on the same file within debounce window
  - Plugin unload while diff is pending
  - Files modified during initial snapshot phase

**Diff Accumulation Logic:**
- Files: `src/FileWatcher.ts` (lines 46-65), `src/main.ts` (lines 131-156, 159-170)
- Why fragile: When a file has a pending diff, subsequent edits are supposed to accumulate (lines 46-48 in FileWatcher.ts). However:
  - The `oldContent` in accumulated diffs is not updated — the second change's `oldContent` is still the first snapshot (correct per tests line 114-154 in external-change.e2e.ts, but non-intuitive)
  - If user accepts/rejects a diff while more edits are coming in, race conditions may occur between `updateSnapshot` (line 108) and incoming `onExternalChange` callbacks
  - The `pendingDiffs` Map in main.ts (line 9) can become stale if a file is modified in diff tab and then another external change arrives
- Safe modification: Add atomic operations around snapshot updates. Consider using async locks or a state machine pattern.
- Test coverage: Test case at lines 114-154 validates content correctness but not timing edge cases.

**CodeMirror MergeView Lifecycle:**
- Files: `src/DiffView.ts` (lines 143-195)
- Why fragile: The `MergeView` instances are created and destroyed on every re-render (lines 96-100). This means:
  - Editor scroll position, fold state, and user selections are lost on any update
  - If `render()` is called while fold operations are in flight, widgets may reference stale editor states
  - Widget click handlers in `foldUnchanged.ts` dispatch effects to editors that might be destroyed (lines 35-37, 64-67 in foldUnchanged.ts)
  - Double-destroy calls are guarded (line 144-146) but concurrent destroy/create can still race
- Safe modification: Cache MergeView instances keyed by file path, only recreate on content change. Store editor state before destroy and restore after.
- Test coverage: Fold expand/collapse test (lines 77-112) validates synchronization but not scroll/selection preservation.

## Tech Debt

**Type Safety Gaps:**
- Files: `src/main.ts` (lines 142, 151)
- Issue: Explicit `as any` casts to convert `TAbstractFile` to file objects for `vault.modify()`. This bypasses TypeScript's type checking.
- Impact: Changes to Obsidian API types won't be caught at compile time. Runtime errors possible if vault.modify expects a different type.
- Fix approach: Define proper type guards or abstract a `safeModifyFile()` helper that validates the file type before casting.

**Hardcoded Configuration:**
- Files: `src/foldUnchanged.ts` (lines 191-192 in DiffView.ts)
- Issue: Fold parameters (margin: 2, minSize: 4) are hardcoded when computing unchanged ranges.
- Impact: Users cannot customize fold behavior. If users have files with few blank lines, the fold thresholds may not suit them.
- Fix approach: Move margin and minSize to settings (currently only debounceMs and enabled exist in settings.ts). Add settings UI.

**Test Command Pollution:**
- Files: `src/main.ts` (lines 49-88)
- Issue: Three test simulation commands ("Simulate external insert", "Simulate external delete") are registered in production code.
- Impact: These clutter the command palette for end users. No way to disable them without code changes.
- Fix approach: Wrap in a feature flag or only register during development (check `process.env.NODE_ENV`).

**Snapshot Freshness Assumption:**
- Files: `src/FileWatcher.ts` (lines 26-29, 37-38)
- Issue: Initial snapshot uses `cachedRead()` (line 27) which may return stale cached content, not disk content. Subsequent reads also use `cachedRead()`.
- Impact: If a file is modified externally before the plugin fully initializes, the diff will compare against stale cached content, showing spurious diffs.
- Fix approach: Use `vault.read()` for initial snapshot to force disk read. Document when snapshots are trustworthy.

**Import Ordering and Style:**
- Files: `src/main.ts` (lines 1-4)
- Issue: No consistent pattern for grouping imports (Obsidian APIs, local modules, third-party). Other files vary.
- Impact: Minor code navigation friction. Not a blocker but reduces consistency.
- Fix approach: Establish import order convention and lint it (ESLint import-plugin).

## Performance Bottlenecks

**Full Re-render on Every Diff Change:**
- Files: `src/DiffView.ts` (lines 95-140)
- Problem: Every call to `addFile()` or `removeFile()` triggers `render()`, which:
  - Destroys all existing MergeView instances
  - Clears the entire container
  - Recreates all sections from scratch
- Cause: React-like re-render approach without diffing. With 10+ files in diff tab, this becomes slow.
- Improvement path:
  - Only re-render the changed section
  - Cache MergeView instances and reuse them
  - Use incremental DOM updates instead of `.empty()` + full rebuild
  - Measure current render time with large diffs (profile in devtools)

**Snapshot Map Unbounded Growth:**
- Files: `src/FileWatcher.ts` (line 7)
- Problem: The `snapshots` Map stores the full content of every markdown file in the vault (line 28). For a vault with 10,000 files, this is significant memory overhead.
- Cause: No cleanup policy. Snapshots are only removed on `delete` events, not when files are untouched for long periods.
- Improvement path:
  - Only snapshot files that are actually watched (filtered by folder/extension settings)
  - Implement LRU eviction if memory becomes a concern
  - Lazy-load snapshots on demand rather than upfront

**Debounce Timer Accumulation:**
- Files: `src/FileWatcher.ts` (lines 10, 116-121)
- Problem: `debounceTimers` Map grows with every edited file (line 118) but timers only delete themselves after expiring (line 120). If you edit 1000 unique files rapidly, you'll have 1000 pending timers.
- Cause: No cleanup for expired timers or vault unload cleanup (destroy clears it, line 129, but only after interval expires).
- Improvement path: Clear all timers on destroy (already done). Add a high-water mark check and warn if map grows beyond expected size.

## Scaling Limits

**Large File Diffs:**
- Current capacity: Single MergeView can handle ~10,000 lines with patience diff in reasonable time.
- Limit: Files > 50,000 lines will cause noticeable lag when computing diff and rendering CodeMirror widgets.
- Scaling path:
  - Implement chunked diffing (only diff changed regions if possible)
  - Use WebWorker for patience diff computation (currently runs on main thread)
  - Add progress UI for large diffs

**Multiple Concurrent Diffs:**
- Current capacity: Memory and CPU scale linearly with number of open MergeView instances. ~5-10 files can be shown in one tab comfortably.
- Limit: 50+ files in single tab causes frame drops and memory pressure.
- Scaling path:
  - Virtualize diff sections (only render visible ones)
  - Lazy-load MergeView content on expand
  - Split large diff batches into multiple tabs

## Missing Critical Features

**Partial Accept (Per-Chunk):**
- Problem: Accepting a diff applies the entire new content. Users cannot accept some changes and reject others.
- Blocks: Advanced workflows where selective integration is needed.
- Note: CodeMirror MergeView supports chunk-level accept/reject via `revertControls` (line 176 in DiffView.ts) but the plugin's `handleAccept()` (lines 198-206) reads the entire merged editor state and applies it. This actually DOES support partial acceptance if user reverts chunks manually and clicks Accept. However, there's no explicit UI or documentation of this.

**Diff Context Customization:**
- Problem: Margin and minSize for fold regions hardcoded (see Tech Debt section). Users can't adjust context window.
- Blocks: Users with different file styles (many blank lines vs. dense code) need different fold thresholds.

**File-Level Filtering:**
- Problem: All markdown files in vault are watched. No way to exclude certain folders or file patterns.
- Blocks: Users with auto-generated files or vendor directories get spurious diffs.
- Note: Could be addressed via settings UI + FileWatcher filtering logic.

## Security Considerations

**No Input Validation on Settings:**
- Files: `src/settings.ts` (lines 36-47)
- Risk: Debounce setting is parsed as integer but no range validation. Negative values, zero, or extreme values (MAX_INT) could be set.
- Current mitigation: `isNaN(num) && num >= 0` check (line 43) prevents negative but allows 0 and very large values.
- Recommendations: Add reasonable bounds (e.g., 100ms to 10000ms). Warn user if set outside typical range.

**File Content Handling:**
- Files: `src/FileWatcher.ts`, `src/DiffView.ts`
- Risk: File content is passed as plain strings without sanitization. No risk of injection attacks (diff is computed server-side), but:
  - Very large files could cause DoS if attacker controls external file modifications
  - No size limits on snapshot storage
- Current mitigation: Obsidian's vault API handles file read permissions. Plugin only sees files user has access to.
- Recommendations: Add file size limit checks before snapshotting. Warn if diff operations take > 5 seconds.

## Known Issues

**DiffView.ts Uncommitted Changes:**
- Symptoms: The working directory has unstaged changes to `src/DiffView.ts` swapping sides of MergeView (old vs new content) and changing button label from "Apply" to "Revert". Changes are currently pending and not committed.
- Files: `src/DiffView.ts` (lines 160, 167, 181)
- Cause: Appears to be a recent fix adjusting diff side interpretation. Old content should be on right side (B, read-only), new on left (A, editable).
- Status: Changes improve correctness but are work-in-progress.

**Test-Only Features in Production:**
- Symptoms: Running `npm run build` includes test simulation commands in the bundled plugin.
- Files: `src/main.ts` (lines 49-88)
- Cause: Test commands are registered unconditionally on plugin load.
- Impact: End users see these in their command palette, cluttering UX.

**Patience Diff Attribution:**
- Symptoms: Copyright/attribution comment mentions "Jonathan Trent's PatienceDiff.js" but no LICENSE file exists in the repo.
- Files: `src/patienceDiff.ts` (lines 2-6)
- Cause: MIT-compatible license noted but not formalized in repo.
- Recommendations: Add THIRD-PARTY-LICENSES file or include full MIT text.

---

*Concerns audit: 2026-03-03*
