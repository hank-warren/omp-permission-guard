/**
 * Smoke test for the load-bearing logic: the vendored analyzer, the
 * prove-or-block heuristic, the tier resolver, and the orchestrator. Runs with
 * `bun test`; needs no `@oh-my-pi/*` package (guardian is not exercised here —
 * it requires a live model, covered by the manual in-session smoke test).
 */
import { describe, expect, test } from "bun:test";
import { evaluatePermission } from "../src/evaluate";
import { classifyHeuristic } from "../src/heuristic";
import { analyzeBashCommand } from "../src/safety-net/index";
import { getToolTier } from "../src/tier";

const WS = process.cwd();
const ctx = { workspaceRoot: WS, tier: "exec" as const };

describe("vendored analyzer", () => {
	test("flags rm -rf /", () => {
		expect(analyzeBashCommand("rm -rf /", WS)).not.toBeNull();
	});
	test("passes ls", () => {
		expect(analyzeBashCommand("ls -la", WS)).toBeNull();
	});
});

describe("classifyHeuristic (bash)", () => {
	test("proven-dangerous rm -rf / -> deny", () => {
		expect(classifyHeuristic("bash", { command: "rm -rf /" }, ctx).decision).toBe("deny");
	});
	test("flat in-workspace command -> allow", () => {
		expect(classifyHeuristic("bash", { command: "ls -la" }, ctx).decision).toBe("allow");
	});
	test("in-workspace pipeline -> allow", () => {
		expect(classifyHeuristic("bash", { command: "grep -r foo src && cat README.md" }, ctx).decision).toBe("allow");
	});
	test("write to /etc -> not allow (out-of-workspace target)", () => {
		expect(classifyHeuristic("bash", { command: "touch /etc/omp-test" }, ctx).decision).not.toBe("allow");
	});
	test("command substitution -> uncertain", () => {
		expect(classifyHeuristic("bash", { command: "echo $(whoami)" }, ctx).decision).toBe("uncertain");
	});
	test("sudo rm -> deny (critical pattern)", () => {
		expect(classifyHeuristic("bash", { command: "sudo rm /var/log/x" }, ctx).decision).toBe("deny");
	});
});

describe("classifyHeuristic (other tools)", () => {
	test("unknown exec-tier tool (ssh) -> uncertain", () => {
		expect(classifyHeuristic("ssh", { cmd: "reboot" }, { workspaceRoot: WS, tier: "exec" }).decision).toBe(
			"uncertain",
		);
	});
	test("write inside workspace -> allow", () => {
		expect(
			classifyHeuristic("write", { path: "notes.txt" }, { workspaceRoot: WS, tier: "write" }).decision,
		).toBe("allow");
	});
	test("write to ~/.ssh -> deny", () => {
		expect(
			classifyHeuristic("write", { path: "~/.ssh/authorized_keys" }, { workspaceRoot: WS, tier: "write" }).decision,
		).toBe("deny");
	});
});

describe("getToolTier", () => {
	test("static fallbacks", () => {
		expect(getToolTier("bash", {}, undefined)).toBe("exec");
		expect(getToolTier("read", {}, undefined)).toBe("read");
		expect(getToolTier("write", {}, undefined)).toBe("write");
		expect(getToolTier("mcp__x__y", {}, undefined)).toBe("write");
		expect(getToolTier("totally_unknown_tool", {}, undefined)).toBe("exec");
	});
	test("live registry tier wins", () => {
		const tools = [{ name: "custom", approval: "read" }];
		expect(getToolTier("custom", {}, tools)).toBe("read");
	});
});

describe("evaluatePermission (no guardian)", () => {
	const base = { userPolicies: {}, workspaceRoot: WS, hasUI: true } as const;

	test("heuristic: rm -rf / -> deny", async () => {
		const a = await evaluatePermission({
			toolName: "bash",
			args: { command: "rm -rf /" },
			tier: "exec",
			mode: "heuristic",
			...base,
		});
		expect(a.action).toBe("deny");
	});
	test("heuristic: ls -> allow", async () => {
		const a = await evaluatePermission({
			toolName: "bash",
			args: { command: "ls" },
			tier: "exec",
			mode: "heuristic",
			...base,
		});
		expect(a.action).toBe("allow");
	});
	test("heuristic: uncertain ssh -> deny (no judge)", async () => {
		const a = await evaluatePermission({
			toolName: "ssh",
			args: { cmd: "x" },
			tier: "exec",
			mode: "heuristic",
			...base,
		});
		expect(a.action).toBe("deny");
	});
	test("hybrid: uncertain + no guardian + UI -> prompt (fail safe)", async () => {
		const a = await evaluatePermission({
			toolName: "ssh",
			args: { cmd: "x" },
			tier: "exec",
			mode: "hybrid",
			...base,
		});
		expect(a.action).toBe("prompt");
	});
	test("hybrid: uncertain + no guardian + no UI -> deny (fail safe)", async () => {
		const a = await evaluatePermission({
			toolName: "ssh",
			args: { cmd: "x" },
			tier: "exec",
			mode: "hybrid",
			userPolicies: {},
			workspaceRoot: WS,
			hasUI: false,
		});
		expect(a.action).toBe("deny");
	});
	test("user policy allow bypasses heuristic", async () => {
		const a = await evaluatePermission({
			toolName: "bash",
			args: { command: "rm -rf /" },
			tier: "exec",
			mode: "heuristic",
			userPolicies: { bash: "allow" },
			workspaceRoot: WS,
			hasUI: true,
		});
		expect(a.action).toBe("allow");
	});
});
