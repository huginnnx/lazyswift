import {execa} from 'execa';

import type {SchemesListResult, XcodeContainer} from './types.js';

type XcodebuildListJson = {
	project?: {schemes?: string[]};
	workspace?: {schemes?: string[]};
};

export async function listSchemes(
	container: XcodeContainer,
): Promise<SchemesListResult> {
	if (process.platform !== 'darwin') {
		return {ok: false, error: 'xcodebuild solo está disponible en macOS.'};
	}

	const args =
		container.type === 'workspace'
			? ['-list', '-json', '-workspace', container.path]
			: ['-list', '-json', '-project', container.path];

	const result = await execa({reject: false, all: true})`xcodebuild ${args}`;
	if (result.failed) {
		return {
			ok: false,
			error: `xcodebuild falló (exitCode ${result.exitCode ?? '—'})`,
			stderr: result.all || result.stderr,
		};
	}

	try {
		const parsed = JSON.parse(result.stdout) as XcodebuildListJson;
		const schemes = parsed.workspace?.schemes ?? parsed.project?.schemes ?? [];
		return {ok: true, schemes};
	} catch (error) {
		return {
			ok: false,
			error: 'No se pudo parsear JSON de xcodebuild.',
			stderr: String(error),
		};
	}
}

