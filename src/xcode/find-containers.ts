import fg from 'fast-glob';
import path from 'node:path';

import type {XcodeContainer} from './types.js';

type FindXcodeContainersOptions = {
	cwd: string;
	deep?: number;
};

export async function findXcodeContainers({
	cwd,
	deep = 4,
}: FindXcodeContainersOptions): Promise<XcodeContainer[]> {
	const entries = await fg(['**/*.xcworkspace', '**/*.xcodeproj'], {
		cwd,
		absolute: true,
		onlyFiles: false,
		deep,
		followSymbolicLinks: false,
		ignore: [
			'**/node_modules/**',
			'**/.git/**',
			'**/DerivedData/**',
			'**/build/**',
			'**/.build/**',
		],
	});

	const containers: XcodeContainer[] = entries
		.map(entry => {
			const ext = path.extname(entry);
			const type = ext === '.xcworkspace' ? 'workspace' : 'project';
			const name = path.basename(entry, ext);
			return {type, path: entry, name} satisfies XcodeContainer;
		})
		.sort((a, b) => {
			if (a.type !== b.type) return a.type === 'workspace' ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

	return containers;
}

