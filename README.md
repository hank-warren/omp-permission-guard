# omp-permission-guard

A classifier-based tool-approval gate for the [oh-my-pi](https://github.com/can1357/oh-my-pi) (`omp`) coding agent.

It intercepts every tool call via the extension `tool_call` hook and, depending on the active mode, **allows / blocks / prompts** — using a vendored shell-command analyzer, risky-path rules, and an optional ephemeral LLM "guardian" judge.

This is a standalone port of the (rejected) core PR [can1357/oh-my-pi#1510](https://github.com/can1357/oh-my-pi/pull/1510) — "Multi-mode tool permissions: heuristic / guardian / hybrid" — which the maintainer closed as *not planned* (issue #1542). The logic is lifted essentially verbatim; only the wiring is adapted from core's approval engine to the extension `tool_call` hook.

## Modes

| Mode | Behavior |
|---|---|
| `off` | Disabled — pass-through (default). |
| `heuristic` | Prove-or-block. Bash → vendored command analyzer + workspace/path containment; `eval` → dangerous-code detection; `write`/`edit`/`ast_edit`/`lsp`/`tts` → risky-path rules. `allow` on positive proof, `deny` on proven danger/escape, and `deny` on anything that can't be proven safe (no judge to escalate to). |
| `guardian` | An ephemeral one-shot LLM judge reviews **exec-tier** calls (bash, eval, ssh, browser, task, …); read/write auto-allow. |
| `hybrid` | Heuristic first; a proven `deny` is terminal, only `uncertain` calls escalate to the guardian. **Recommended.** |

A tool call resolves to one of three actions:
- **allow** → the call runs.
- **deny** → blocked; the model receives the reason as the tool error.
- **prompt** → in an interactive session you get a confirm dialog; with **no UI** (print mode, subagents) it fails safe (blocks).

`read`-tier tools are never gated.

## Mode precedence

`/guard <mode>` (session) > `OMP_GUARD_MODE` env > `~/.omp/agent/permission-guard.json` > default (`off`).

## Configuration

`~/.omp/agent/permission-guard.json`:

```json
{
  "mode": "hybrid",
  "guardianModel": "",
  "maxAttempts": 3,
  "approval": { "bash": "prompt" }
}
```

- `mode` — `off` | `heuristic` | `guardian` | `hybrid`.
- `guardianModel` — model spec (`provider/id`) or role alias for the judge. Empty → the fast role chain (`@smol` → `@commit`) → the session model.
- `maxAttempts` — guardian retry budget (default 3).
- `approval` — per-tool overrides, authoritative in **every** mode: `allow` bypasses the classifier, `deny` always blocks, `prompt` always asks.

Runtime: `/guard status` shows the mode; `/guard hybrid` (or `off`/`heuristic`/`guardian`) switches it for the current session.

## Install

```
omp plugin link /path/to/omp-permission-guard
```

Then start (or restart) `omp`. Verify with `omp plugin list` / `omp plugin doctor`.

The bundled `shell-quote` dependency must be present in the repo's `node_modules` (run `bun install` after cloning). The guardian's LLM call resolves `@oh-my-pi/pi-ai` from the global omp install at runtime; if it can't be found, `guardian`/`hybrid` degrade to fail-safe (prompt with UI, deny without) and `heuristic` mode is unaffected.

### Recommended pairing

The guard runs **in addition to** core's own tier approval (`tools.approvalMode`). To make it the *primary* smart gate — auto-allowing proven-safe calls instead of double-prompting — pair it with core in `yolo`:

```yaml
# ~/.omp/agent/config.yml
tools:
  approvalMode: yolo
```

with the guard in `hybrid`. Core then stops prompting on tier, and the guard decides. Left in core `write`/`always-ask` mode, the guard only *adds* gating (it can block/deny but core still prompts on exec-tier).

## Disable

`/guard off`, or `OMP_GUARD_MODE=off`, or set `"mode": "off"` in the config, or `omp plugin disable omp-permission-guard`.

## Provenance & license

- Extension logic ported from PR #1510 (`packages/coding-agent/src/tools/permission/*`, `edit/approval-path.ts`, `tools/bash-cwd.ts`, `tools/critical-bash-patterns.ts`, `prompts/system/guardian-system.md`).
- `src/safety-net/` is vendored from [`cc-safety-net`](https://github.com/kenryu42/claude-code-safety-net) (MIT, v0.9.0) — see `src/safety-net/LICENSE`.
- This package: MIT.
