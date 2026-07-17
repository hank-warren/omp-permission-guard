/**
 * Vendored command-safety analyzer.
 *
 * Ported from `cc-safety-net` (https://github.com/kenryu42/claude-code-safety-net),
 * MIT-licensed, version 0.9.0. Only the pure analysis core is vendored here; the
 * upstream plugin hooks, CLI, config-file loader, and audit/format helpers are
 * intentionally omitted. See ./LICENSE for the original license and attribution.
 *
 * Import-path aliases (`@/...`) were mechanically rewritten to relative paths;
 * the analysis logic is otherwise unmodified.
 */
import { analyzeCommandInternal } from "./core/analyze/analyze-command";
import { containsDangerousCode, extractInterpreterCodeArg } from "./core/analyze/interpreters";
import type { AnalyzeResult, Config } from "./types";

/** Empty config — the file-based custom-rule loader is not vendored. */
const EMPTY_CONFIG: Config = { version: 1, rules: [] };

/**
 * Analyze a bash command for destructive patterns.
 *
 * @returns a block result (`reason` + offending `segment`) or `null` if the
 * command is considered safe.
 */
export function analyzeBashCommand(command: string, cwd: string | undefined): AnalyzeResult | null {
	return analyzeCommandInternal(command, 0, { cwd, config: EMPTY_CONFIG });
}

export { containsDangerousCode, extractInterpreterCodeArg };
export type { AnalyzeResult };
