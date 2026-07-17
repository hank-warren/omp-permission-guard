/**
 * Extract a leading `cd <path> && ...` prefix the bash tool would treat as the
 * effective cwd.
 *
 * The bash tool rewrites a leading `cd <path> && ...` into the effective cwd
 * when the model ignores the explicit `cwd` parameter, so the permission
 * heuristic must use the SAME extraction to analyze the command in the
 * directory it actually runs in. This is the single source of truth for that
 * rewrite — both `BashTool.execute` and the heuristic call it.
 *
 * Constrained to a single line so a `&&` that sits on a later line of a
 * multiline script can't pull the entire script into the "cwd" capture.
 */
export function extractLeadingCd(command: string): { cd: string | undefined; command: string } {
	const m = command.match(/^cd[ \t]+((?:[^&\\\n\r]|\\.)+?)[ \t]*&&[ \t]*/);
	if (!m) return { cd: undefined, command };
	return { cd: m[1]!.trim().replace(/^["']|["']$/g, ""), command: command.slice(m[0].length) };
}
