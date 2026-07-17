import { getBasename, stripWrappersWithInfo } from "../../core/shell";

export interface ChildCommandContext {
	cwd: string | undefined;
	envAssignments?: ReadonlyMap<string, string>;
}

export function normalizeChildCommand(tokens: readonly string[], context: ChildCommandContext) {
	const wrapperInfo = stripWrappersWithInfo([...tokens], context.cwd);
	const envAssignments = new Map(context.envAssignments ?? []);
	for (const [k, v] of wrapperInfo.envAssignments) {
		envAssignments.set(k, v);
	}

	const childTokens =
		getBasename(wrapperInfo.tokens[0] ?? "").toLowerCase() === "busybox" && wrapperInfo.tokens.length > 1
			? wrapperInfo.tokens.slice(1)
			: wrapperInfo.tokens;

	return {
		tokens: childTokens,
		cwd: wrapperInfo.cwd === null ? undefined : (wrapperInfo.cwd ?? context.cwd),
		wrapperCwd: wrapperInfo.cwd,
		envAssignments,
		head: getBasename(childTokens[0] ?? "").toLowerCase(),
	};
}

export function collectCommandTemplate(tokens: readonly string[], start: number) {
	const templateTokens: string[] = [];
	let i = start;
	while (i < tokens.length) {
		const token = tokens[i];
		if (token === undefined || token === ":::") break;
		templateTokens.push(token);
		i++;
	}

	return {
		markerIndex: i < tokens.length && tokens[i] === ":::" ? i : -1,
		templateTokens,
	};
}
