/**
 * Local reimplementation of core `isInternalUrlPath`
 * (`packages/coding-agent/src/tools/path-utils.ts`).
 *
 * True when a tool path argument uses one of omp's internal URL schemes and so
 * must NOT be treated as a filesystem path. The heuristic uses this to punt
 * internal-URL bash/edit targets to `uncertain` instead of misreading them as
 * in-workspace relative paths. Kept in sync with core's
 * `TOP_LEVEL_INTERNAL_URL_PREFIXES`.
 */
import * as os from "node:os";

const INTERNAL_URL_PREFIXES = [
	"agent://",
	"artifact://",
	"skill://",
	"rule://",
	"local://",
	"mcp://",
	"ssh://",
	"vault://",
] as const;

/** Fold a single-slash `local:/x` into the canonical `local://x` form. */
function normalizeLocalScheme(filePath: string): string {
	return filePath.replace(/^(local:)\/(?!\/)/, "$1//");
}

function expandTilde(filePath: string): string {
	if (filePath === "~") return os.homedir();
	if (filePath.startsWith("~/") || filePath.startsWith("~\\")) return os.homedir() + filePath.slice(1);
	return filePath;
}

export function isInternalUrlPath(filePath: string): boolean {
	const normalized = normalizeLocalScheme(filePath.trim());
	const expanded = normalizeLocalScheme(expandTilde(normalized));
	return INTERNAL_URL_PREFIXES.some(prefix => normalized.startsWith(prefix) || expanded.startsWith(prefix));
}
