/**
 * Permission orchestrator. Maps a tool call + guard mode to a concrete action
 * (`allow` / `deny` / `prompt`), layering the heuristic blacklist and the
 * Guardian LLM judge. Adapted from PR #1510's `tools/permission/evaluate.ts`;
 * the tier-mode delegation is dropped (core still owns `always-ask`/`write`/
 * `yolo`) — this only implements the new `heuristic` / `guardian` / `hybrid`
 * modes on top.
 */
import type { GuardianRequest, GuardianVerdict } from "./guardian";
import { classifyHeuristic } from "./heuristic";
import { normalizePolicy, type ToolTier } from "./tier";

export type GuardMode = "heuristic" | "guardian" | "hybrid";

export type PermissionAction =
	| { action: "allow" }
	| { action: "deny"; reason: string }
	| { action: "prompt"; reason?: string };

/** Minimal guardian surface the orchestrator needs. */
export interface Guardian {
	evaluate(req: GuardianRequest, signal?: AbortSignal): Promise<GuardianVerdict>;
}

export interface EvaluatePermissionInput {
	toolName: string;
	args: unknown;
	tier: ToolTier;
	mode: GuardMode;
	/** User per-tool policies (`approval` map), authoritative in every mode. */
	userPolicies: Record<string, unknown>;
	workspaceRoot: string;
	/** Whether an interactive UI exists to prompt the user. */
	hasUI: boolean;
	guardian?: Guardian;
	signal?: AbortSignal;
}

const EXEC_TIER: ToolTier = "exec";

function failSafe(hasUI: boolean, reason?: string): PermissionAction {
	if (hasUI) return reason ? { action: "prompt", reason } : { action: "prompt" };
	return {
		action: "deny",
		reason: reason ? `Guardian unavailable: ${reason}` : "Guardian unavailable; denying to fail safe.",
	};
}

/**
 * Resolve the permission action for a tool call under a non-tier guard mode.
 *
 * - User per-tool policy is authoritative first (`deny` blocks, `allow` bypasses,
 *   `prompt` asks) — it never falls through to the heuristic/guardian path.
 * - `guardian`: ask the LLM judge for exec-tier calls; auto-allow others.
 * - `heuristic`: prove-or-block — `allow` on positive proof, `deny` on proven
 *   danger/escape, `deny` on `uncertain` (no judge to escalate to).
 * - `hybrid`: heuristic first; a proven `deny` is terminal, only `uncertain`
 *   escalates to the Guardian.
 */
export async function evaluatePermission(input: EvaluatePermissionInput): Promise<PermissionAction> {
	const { toolName, args, tier, mode, userPolicies, workspaceRoot, hasUI, guardian, signal } = input;

	const userPolicy = Object.hasOwn(userPolicies, toolName) ? normalizePolicy(userPolicies[toolName]) : undefined;
	if (userPolicy === "deny") return { action: "deny", reason: `Blocked by user policy for ${toolName}.` };
	if (userPolicy === "allow") return { action: "allow" };
	if (userPolicy === "prompt")
		return { action: "prompt", reason: `Confirmation required by user policy for ${toolName}.` };

	const runGuardian = async (reason?: string): Promise<PermissionAction> => {
		if (!guardian) return failSafe(hasUI, reason);
		const verdict = await guardian.evaluate({ toolName, args, reason, cwd: workspaceRoot }, signal);
		if (verdict.decision === "allow") return { action: "allow" };
		if (verdict.decision === "deny") return { action: "deny", reason: verdict.reason };
		return failSafe(hasUI, reason);
	};

	if (mode === "guardian") {
		return tier === EXEC_TIER ? runGuardian() : { action: "allow" };
	}

	// heuristic / hybrid: prove-or-block three-state verdict.
	const verdict = classifyHeuristic(toolName, args, { workspaceRoot, tier });
	if (verdict.decision === "allow") return { action: "allow" };
	if (verdict.decision === "deny") {
		return { action: "deny", reason: verdict.reason ?? `Blocked by safety heuristic for ${toolName}.` };
	}
	// uncertain
	if (mode === "heuristic") {
		return { action: "deny", reason: verdict.reason ?? `Refusing un-provable call for ${toolName}.` };
	}
	// hybrid: escalate only the uncertain call to the Guardian judge.
	return runGuardian(verdict.reason);
}
