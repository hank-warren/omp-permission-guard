/**
 * Bash patterns flagged as safety critical for approval policy.
 *
 * Kept intentionally tight — the cost of a false negative is data loss or a compromised host,
 * while false positives remain actionable through user policy control.
 * New patterns should target shapes that are virtually never legitimate in automation.
 *
 * This is a dependency-free leaf so the permission heuristic can reuse it without
 * pulling in the bash tool's full module graph (tui, theme, exec, …).
 */
export const CRITICAL_BASH_PATTERNS = [
	// Recursive destruction. The optional `(?:--\s+)?` catches the `--` end-of-options
	// form (`rm -rf -- /`, `chown -R user -- /`) which otherwise slips past as a bypass.
	/\brm\s+-[a-z]*[rRfF][a-z]*\s+(?:--\s+)?\//i, // rm -rf /, rm -fr /, rm -rf -- /…
	/\bsudo\s+rm\b/i, // any `sudo rm`.
	/\bchmod\s+-R\s+[0-7]+\s+(?:--\s+)?\//i, // `chmod -R 777 /`, `chmod -R 777 -- /`.
	/\bchmod\s+-R\s+[ugoa+\-=rwxXst,]+\s+(?:--\s+)?\//, // `chmod -R u+x /`, symbolic mode, root target.
	/\bchown\s+-R\s+\S+\s+(?:--\s+)?\//i, // `chown -R user /`, `chown -R user -- /`.

	// Fork bomb (a few common spacings).
	/:\(\)\s*\{\s*:\s*\|\s*:/i,

	// Disk / filesystem destruction.
	/>\s*\/dev\/sd[a-z]/i, // write to disk device.
	/\bmkfs(\.|\b)/i, // format filesystem.
	/\bdd\s+if=.+of=\/dev\//i, // dd to a device.
	/\bshred\s+\/dev\//i,
	/\bcryptsetup\b/i,

	// System-config destruction.
	/>\s*\/etc\/(?:passwd|shadow|sudoers)\b/i,
	/\btee\s+(?:-a\s+)?\/etc\/(?:passwd|shadow|sudoers)\b/i, // `tee /etc/passwd`, `tee -a /etc/sudoers`.

	// Remote-fetch-then-execute (curl/wget piped to a shell or process-subbed).
	/\b(?:curl|wget|fetch)\b[^|]*\|\s*(?:bash|sh|zsh|fish)\b/i,
	// Process-sub variants — `bash <(curl …)`, `source <(curl …)`, `. <(curl …)`. `.` and `source` are
	// anchored to a command boundary so `find . -name` and similar don't false-positive.
	/(?:^|[\s;&|(])(?:bash|sh|zsh|source|\.)\s+<\(\s*(?:curl|wget|fetch)\b/i,
	// Shell `-c` with a fetched payload — `bash -c "$(curl …)"`, `sh -c $(wget …)`,
	// and the backtick form `bash -c "`curl …`"`. Distinct from the pipe form above.
	/\b(?:bash|sh|zsh|fish)\s+-c\s+["']?\$\(\s*(?:curl|wget|fetch)\b/i,
	/\b(?:bash|sh|zsh|fish)\s+-c\s+["']?`\s*(?:curl|wget|fetch)\b/i,
	// `eval "$(curl …)"` / `eval $(curl …)` / `eval \`curl …\``.
	/\beval\s+["'`]?\$\(\s*(?:curl|wget|fetch)\b|\beval\s+`\s*(?:curl|wget|fetch)\b/i,

	// Process/host control.
	/\bkill\s+-9\s+1\b/, // kill PID 1.
	// Process/host control — must sit at command position so `npm run reboot-tests`
	// or `echo 'shutdown the queue'` don't false-positive.
	/(?:^|[\s;&|(])(?:shutdown|poweroff|reboot|halt)(?:\s|$|[;|&])/i,
	/(?:^|[\s;&|(])init\s+0\b/i,

	// Network-shell exfil.
	/\bnc\b[^|;]*\s-[a-zA-Z]*[ec][a-zA-Z]*\s/i, // `nc -e` / `nc -c`.
] as const;

/** True when `command` matches a safety-critical bash pattern. */
export function matchCriticalBashPattern(command: string): boolean {
	return command !== "" && CRITICAL_BASH_PATTERNS.some(pattern => pattern.test(command));
}
