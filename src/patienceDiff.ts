/**
 * Patience diff algorithm — produces more human-intuitive diffs than Myers
 * by anchoring on unique lines first, avoiding misalignment of blank/repeated lines.
 *
 * Ported from Jonathan Trent's PatienceDiff.js (v2.0), MIT-compatible.
 * https://github.com/jonTrent/PatienceDiff
 */

interface DiffEntry {
	line: string;
	aIndex: number;
	bIndex: number;
}

interface DiffResult {
	lines: DiffEntry[];
}

/** Find all values that appear exactly once in arr[lo..hi]. */
function findUnique(arr: string[], lo: number, hi: number): Map<string, number | {count: number; index: number}> {
	const map = new Map<string, {count: number; index: number}>();
	for (let i = lo; i <= hi; i++) {
		const line = arr[i]!;
		const entry = map.get(line);
		if (entry) {
			entry.count++;
			entry.index = i;
		} else {
			map.set(line, {count: 1, index: i});
		}
	}
	const result = new Map<string, number>();
	for (const [key, val] of map) {
		if (val.count === 1) result.set(key, val.index);
	}
	return result;
}

/** Find unique lines common to both arrays. */
function uniqueCommon(aArr: string[], aLo: number, aHi: number, bArr: string[], bLo: number, bHi: number) {
	const ma = findUnique(aArr, aLo, aHi);
	const mb = findUnique(bArr, bLo, bHi);
	const result = new Map<string, {indexA: number; indexB: number; prev?: {indexA: number; indexB: number}}>();
	for (const [key, aIdx] of ma) {
		const bIdx = mb.get(key);
		if (bIdx !== undefined) {
			result.set(key, {indexA: aIdx as number, indexB: bIdx as number});
		}
	}
	return result;
}

/** Compute the longest common subsequence from unique common entries. */
function longestCommonSubsequence(abMap: Map<string, {indexA: number; indexB: number; prev?: {indexA: number; indexB: number}}>)
	: {indexA: number; indexB: number; prev?: {indexA: number; indexB: number}}[] {
	const ja: {indexA: number; indexB: number; prev?: {indexA: number; indexB: number}}[][] = [];
	for (const val of abMap.values()) {
		let i = 0;
		while (ja[i] && ja[i]![ja[i]!.length - 1]!.indexB < val.indexB) i++;
		if (!ja[i]) ja[i] = [];
		if (i > 0) val.prev = ja[i - 1]![ja[i - 1]!.length - 1];
		ja[i]!.push(val);
	}
	if (ja.length === 0) return [];
	const n = ja.length - 1;
	const lcs: typeof ja[0] = [ja[n]![ja[n]!.length - 1]!];
	while (lcs[lcs.length - 1]!.prev) lcs.push(lcs[lcs.length - 1]!.prev!);
	return lcs.reverse();
}

/** Patience diff on two arrays of lines. */
export function patienceDiff(aLines: string[], bLines: string[]): DiffResult {
	const result: DiffEntry[] = [];

	function addToResult(aIndex: number, bIndex: number) {
		result.push({
			line: aIndex >= 0 ? aLines[aIndex]! : bLines[bIndex]!,
			aIndex,
			bIndex,
		});
	}

	function addSubMatch(aLo: number, aHi: number, bLo: number, bHi: number) {
		// Match lines at beginning
		while (aLo <= aHi && bLo <= bHi && aLines[aLo] === bLines[bLo]) {
			addToResult(aLo++, bLo++);
		}
		// Save end matches for later
		const aHiTemp = aHi;
		while (aLo <= aHi && bLo <= bHi && aLines[aHi] === bLines[bHi]) {
			aHi--;
			bHi--;
		}
		// Recurse on remaining
		const ucMap = uniqueCommon(aLines, aLo, aHi, bLines, bLo, bHi);
		if (ucMap.size === 0) {
			while (aLo <= aHi) addToResult(aLo++, -1);
			while (bLo <= bHi) addToResult(-1, bLo++);
		} else {
			recurseLCS(aLo, aHi, bLo, bHi, ucMap);
		}
		// Add end matches
		while (aHi < aHiTemp) {
			aHi++;
			bHi++;
			addToResult(aHi, bHi);
		}
	}

	function recurseLCS(aLo: number, aHi: number, bLo: number, bHi: number,
		ucMap?: Map<string, {indexA: number; indexB: number; prev?: {indexA: number; indexB: number}}>) {
		const x = longestCommonSubsequence(ucMap || uniqueCommon(aLines, aLo, aHi, bLines, bLo, bHi));
		if (x.length === 0) {
			addSubMatch(aLo, aHi, bLo, bHi);
		} else {
			if (aLo < x[0]!.indexA || bLo < x[0]!.indexB) {
				addSubMatch(aLo, x[0]!.indexA - 1, bLo, x[0]!.indexB - 1);
			}
			let i: number;
			for (i = 0; i < x.length - 1; i++) {
				addSubMatch(x[i]!.indexA, x[i + 1]!.indexA - 1, x[i]!.indexB, x[i + 1]!.indexB - 1);
			}
			if (x[i]!.indexA <= aHi || x[i]!.indexB <= bHi) {
				addSubMatch(x[i]!.indexA, aHi, x[i]!.indexB, bHi);
			}
		}
	}

	recurseLCS(0, aLines.length - 1, 0, bLines.length - 1);
	return {lines: result};
}
