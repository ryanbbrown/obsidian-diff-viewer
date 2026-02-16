import {Facet, StateEffect, StateField, RangeSetBuilder, Text} from "@codemirror/state";
import {Decoration, EditorView, WidgetType} from "@codemirror/view";

const foldSyncCallback = Facet.define<(index: number) => void, (index: number) => void>({
	combine: values => values[0] ?? (() => {}),
});

export interface FoldRange {
	from: number;
	to: number;
	lines: number;
}

export const setFoldRanges = StateEffect.define<FoldRange[]>();
export const toggleFold = StateEffect.define<number>();

class CollapsedWidget extends WidgetType {
	constructor(readonly lines: number, readonly index: number) { super(); }

	eq(other: CollapsedWidget) {
		return this.lines === other.lines && this.index === other.index;
	}

	/** Render the collapsed region bar. */
	toDOM(view: EditorView) {
		const div = document.createElement("div");
		div.className = "diff-view-fold-widget";
		const icon = document.createElement("span");
		icon.className = "diff-collapse-icon";
		icon.textContent = "↕";
		div.appendChild(icon);
		const label = document.createElement("span");
		label.textContent = ` ${this.lines} unchanged lines`;
		div.appendChild(label);
		div.addEventListener("click", () => {
			view.dispatch({effects: toggleFold.of(this.index)});
			view.state.facet(foldSyncCallback)(this.index);
		});
		return div;
	}

	get estimatedHeight() { return 27; }
	ignoreEvent(e: Event) { return e instanceof MouseEvent; }
}

class CollapseBarWidget extends WidgetType {
	constructor(readonly lines: number, readonly index: number) { super(); }

	eq(other: CollapseBarWidget) {
		return this.lines === other.lines && this.index === other.index;
	}

	/** Render the collapse-back bar shown after a region is expanded. */
	toDOM(view: EditorView) {
		const div = document.createElement("div");
		div.className = "diff-view-fold-widget diff-view-fold-expanded";
		const icon = document.createElement("span");
		icon.className = "diff-collapse-icon";
		icon.textContent = "↕";
		div.appendChild(icon);
		const label = document.createElement("span");
		label.textContent = ` ${this.lines} unchanged lines`;
		div.appendChild(label);
		div.addEventListener("click", () => {
			view.dispatch({effects: toggleFold.of(this.index)});
			view.state.facet(foldSyncCallback)(this.index);
		});
		return div;
	}

	get estimatedHeight() { return 27; }
	ignoreEvent(e: Event) { return e instanceof MouseEvent; }
}

interface FoldState {
	ranges: FoldRange[];
	foldedIds: Set<number>;
	decorations: ReturnType<typeof buildDecorations>;
}

/** Build decorations from fold ranges and fold state. */
function buildDecorations(ranges: FoldRange[], foldedIds: Set<number>) {
	const builder = new RangeSetBuilder<Decoration>();
	for (let i = 0; i < ranges.length; i++) {
		const r = ranges[i]!;
		if (r.from >= r.to) continue;
		if (foldedIds.has(i)) {
			builder.add(r.from, r.to, Decoration.replace({
				widget: new CollapsedWidget(r.lines, i),
				block: true,
			}));
		} else {
			builder.add(r.from, r.from, Decoration.widget({
				widget: new CollapseBarWidget(r.lines, i),
				block: true,
				side: -1,
			}));
		}
	}
	return builder.finish();
}

export const foldField = StateField.define<FoldState>({
	create: () => ({ranges: [], foldedIds: new Set(), decorations: Decoration.none}),
	update: (state, tr) => {
		let changed = false;
		let {ranges, foldedIds} = state;

		if (tr.docChanged) {
			ranges = ranges.map(r => ({
				from: tr.changes.mapPos(r.from),
				to: tr.changes.mapPos(r.to),
				lines: r.lines,
			}));
			changed = true;
		}

		for (const e of tr.effects) {
			if (e.is(setFoldRanges)) {
				ranges = e.value;
				foldedIds = new Set(ranges.map((_, i) => i));
				changed = true;
			}
			if (e.is(toggleFold)) {
				foldedIds = new Set(foldedIds);
				if (foldedIds.has(e.value)) foldedIds.delete(e.value);
				else foldedIds.add(e.value);
				changed = true;
			}
		}

		if (!changed) return state;
		return {ranges, foldedIds, decorations: buildDecorations(ranges, foldedIds)};
	},
	provide: f => EditorView.decorations.from(f, s => s.decorations),
});

/** Create extensions for the custom fold system. onClick syncs the toggle to the sibling editor. */
export function foldUnchangedExtension(onClick: (index: number) => void) {
	return [
		foldField,
		foldSyncCallback.of(onClick),
	];
}

/** Compute unchanged ranges from MergeView chunks. */
export function computeUnchangedRanges(
	doc: Text,
	chunks: readonly {fromA: number; toA: number; fromB: number; toB: number}[],
	side: "a" | "b",
	margin: number,
	minSize: number,
): FoldRange[] {
	const ranges: FoldRange[] = [];
	let prevEndLine = 0;

	for (let i = 0; i <= chunks.length; i++) {
		const chunk = i < chunks.length ? chunks[i] : null;
		const startLine = i === 0 ? 1 : prevEndLine + 1 + margin;

		let endLine: number;
		if (chunk) {
			const chunkStart = side === "a" ? chunk.fromA : chunk.fromB;
			endLine = doc.lineAt(chunkStart).number - 1 - margin;
		} else {
			endLine = doc.lines;
		}

		const lineCount = endLine - startLine + 1;
		if (lineCount >= minSize && startLine >= 1 && endLine <= doc.lines && startLine <= endLine) {
			ranges.push({
				from: doc.line(startLine).from,
				to: doc.line(endLine).to,
				lines: lineCount,
			});
		}

		if (chunk) {
			const chunkEnd = side === "a" ? chunk.toA : chunk.toB;
			prevEndLine = doc.lineAt(Math.min(doc.length, chunkEnd)).number;
		}
	}

	return ranges;
}
