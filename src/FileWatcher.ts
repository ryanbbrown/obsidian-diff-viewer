import {App, MarkdownView, TAbstractFile, TFile} from "obsidian";
import type {ExternalDiffSettings} from "./settings";

export class FileWatcher {
	private app: App;
	private settings: ExternalDiffSettings;
	private snapshots = new Map<string, string>();
	private recentlyEditedInternally = new Set<string>();
	private pendingExternalPaths = new Set<string>();
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private onExternalChange: (path: string, oldContent: string, newContent: string) => void;

	constructor(
		app: App,
		settings: ExternalDiffSettings,
		onExternalChange: (path: string, oldContent: string, newContent: string) => void,
	) {
		this.app = app;
		this.settings = settings;
		this.onExternalChange = onExternalChange;
	}

	/** Snapshot all markdown files and begin watching vault events. */
	async start(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();
		await Promise.all(files.map(async (file) => {
			const content = await this.app.vault.cachedRead(file);
			this.snapshots.set(file.path, content);
		}));
	}

	/** Handle vault 'modify' event. */
	handleModify = async (file: TAbstractFile): Promise<void> => {
		if (!(file instanceof TFile) || file.extension !== "md") return;
		if (!this.settings.enabled) return;

		const newContent = await this.app.vault.cachedRead(file);
		const oldContent = this.snapshots.get(file.path);

		if (oldContent === undefined || oldContent === newContent) {
			this.snapshots.set(file.path, newContent);
			return;
		}

		// If this file already has an unresolved external diff, always accumulate
		if (this.pendingExternalPaths.has(file.path)) {
			this.onExternalChange(file.path, oldContent, newContent);
			return;
		}

		// Debounce-based check (covers normal typing within the timer window)
		if (this.recentlyEditedInternally.has(file.path)) {
			this.snapshots.set(file.path, newContent);
			return;
		}

		// Content-based check (covers paste/undo where save fires after debounce expires)
		if (this.editorHasContent(file.path, newContent)) {
			this.snapshots.set(file.path, newContent);
			return;
		}

		// External change — don't update snapshot so subsequent edits accumulate
		this.pendingExternalPaths.add(file.path);
		this.onExternalChange(file.path, oldContent, newContent);
	};

	/** Check if any open editor for this file already shows the given content. */
	private editorHasContent(path: string, content: string): boolean {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === path) {
				if (view.editor.getValue() === content) return true;
			}
		}
		return false;
	}

	/** Handle vault 'create' event — snapshot new files. */
	handleCreate = async (file: TAbstractFile): Promise<void> => {
		if (!(file instanceof TFile) || file.extension !== "md") return;
		const content = await this.app.vault.cachedRead(file);
		this.snapshots.set(file.path, content);
	};

	/** Handle vault 'delete' event — remove snapshot. */
	handleDelete = (file: TAbstractFile): void => {
		if (!(file instanceof TFile)) return;
		this.snapshots.delete(file.path);
		this.recentlyEditedInternally.delete(file.path);
	};

	/** Handle vault 'rename' event — move snapshot to new path. */
	handleRename = (file: TAbstractFile, oldPath: string): void => {
		if (!(file instanceof TFile)) return;
		const content = this.snapshots.get(oldPath);
		if (content !== undefined) {
			this.snapshots.delete(oldPath);
			this.snapshots.set(file.path, content);
		}
		if (this.recentlyEditedInternally.has(oldPath)) {
			this.recentlyEditedInternally.delete(oldPath);
			this.recentlyEditedInternally.add(file.path);
		}
	};

	/** Update the stored snapshot for a file (called after accept/reject). */
	updateSnapshot(path: string, content: string): void {
		this.snapshots.set(path, content);
		this.pendingExternalPaths.delete(path);
	}

	/** Mark a file as internally edited to prevent self-triggered diffs. */
	markAsInternalEdit(path: string): void {
		this.recentlyEditedInternally.add(path);
		const existing = this.debounceTimers.get(path);
		if (existing) clearTimeout(existing);
		this.debounceTimers.set(path, setTimeout(() => {
			this.recentlyEditedInternally.delete(path);
			this.debounceTimers.delete(path);
		}, this.settings.debounceMs));
	}

	/** Clean up timers on unload. */
	destroy(): void {
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
		this.recentlyEditedInternally.clear();
		this.pendingExternalPaths.clear();
		this.snapshots.clear();
	}
}
