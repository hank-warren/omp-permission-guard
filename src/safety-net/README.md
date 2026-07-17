# Vendored: cc-safety-net (analysis core)

This directory is a partial vendored copy of
[`cc-safety-net`](https://github.com/kenryu42/claude-code-safety-net) (MIT).

- **Upstream**: https://github.com/kenryu42/claude-code-safety-net
- **Pinned at**: `v0.9.0` (+17, commit `f37126bb16d8f79ad752891da6bc2e40db844fac`)
- **License**: MIT — see [`LICENSE`](./LICENSE).

## What is vendored

Only the **pure command-analysis core** is copied:

- `core/analyze/**` — segment/parallel/xargs/find/interpreter analysis.
- `core/{shell,worktree,path,rules-git,rules-rm,rules-custom}.ts` — shell
  parsing and the git/rm rule sets.
- `types.ts` — analysis types and constants.

`index.ts` is the local facade: `analyzeBashCommand(command, cwd)` and the
interpreter helpers (`containsDangerousCode`, `extractInterpreterCodeArg`).

## What is NOT vendored (intentional carve-out)

The upstream plugin/CLI surface is **dropped**: OpenCode/Gemini/Copilot hook
adapters, the `bin/` CLI, the `.safety-net.json` / `~/.cc-safety-net`
config-file loader (`core/config.ts`), audit logging, and the block-message
formatter. The facade passes an empty config, so custom file-based rules are a
no-op here; blocking is driven entirely by the built-in rule sets.

## Local modifications

- `@/…` path aliases were rewritten to relative imports.
- No analysis logic was changed.

To re-sync, re-copy the files above from the pinned upstream, re-run the
`@/` → relative rewrite, and update the pin in this file.
