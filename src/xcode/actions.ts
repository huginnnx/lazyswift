import fg from 'fast-glob';
import path from 'node:path';
import fs from 'node:fs/promises';

import type {XcodeContainer} from './types.js';
import {runCapture, runStreamed} from './command-runner.js';

export type ActiveContext = {
	container: XcodeContainer;
	scheme: string;
	simulatorUdid: string;
};

export type ActionIO = {
	addLog: (line: string) => void;
	cwd: string;
};

export function getXcodebuildContainerArgs(container: XcodeContainer): string[] {
	return container.type === 'workspace'
		? ['-workspace', container.path]
		: ['-project', container.path];
}

export function getDerivedDataPath(cwd: string): string {
	return path.join(cwd, '.lazyswift', 'DerivedData');
}

async function ensureDir(dir: string) {
	await fs.mkdir(dir, {recursive: true});
}

async function findLatestAppInDerivedData(derivedDataPath: string): Promise<string | null> {
	const apps = await fg(['Build/Products/**/*.app'], {
		cwd: derivedDataPath,
		absolute: true,
		onlyFiles: false,
	});

	if (apps.length === 0) return null;

	const withStats = await Promise.all(
		apps.map(async appPath => {
			const stat = await fs.stat(appPath);
			return {appPath, mtimeMs: stat.mtimeMs};
		}),
	);

	withStats.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return withStats[0]?.appPath ?? null;
}

async function getBundleIdFromApp(appPath: string): Promise<string> {
	const infoPlistPath = path.join(appPath, 'Info.plist');
	const result = await runCapture({
		file: 'plutil',
		args: ['-extract', 'CFBundleIdentifier', 'raw', '-o', '-', infoPlistPath],
	});

	if (!result.ok) {
		throw new Error(
			`plutil falló (exitCode ${result.exitCode ?? '—'}): ${result.stderr || result.stdout}`,
		);
	}

	const bundleId = result.stdout.trim();
	if (bundleId.length === 0) {
		throw new Error('No se pudo leer CFBundleIdentifier (stdout vacío).');
	}

	return bundleId;
}

export async function runBuild(context: ActiveContext, io: ActionIO) {
	const args = [
		'build',
		...getXcodebuildContainerArgs(context.container),
		'-scheme',
		context.scheme,
		'-destination',
		`id=${context.simulatorUdid}`,
	];

	io.addLog('Build: iniciando…');
	const result = await runStreamed({
		prefix: '[xcodebuild]',
		file: 'xcodebuild',
		args,
		cwd: io.cwd,
		addLog: io.addLog,
	});

	if (!result.ok) {
		io.addLog(`Build: falló (exitCode ${result.exitCode ?? '—'})`);
		return;
	}

	io.addLog('Build: OK');
}

export async function runBuildAndRun(context: ActiveContext, io: ActionIO) {
	io.addLog('Build & Run: preparando simulador…');

	{
		// `simctl` puede bootear el device aunque Simulator.app no esté abierto.
		// Abrimos Simulator.app para que el usuario vea el simulador levantado.
		const result = await runStreamed({
			prefix: '[open]',
			file: 'open',
			args: [
				'-a',
				'Simulator',
				'--args',
				'-CurrentDeviceUDID',
				context.simulatorUdid,
			],
			cwd: io.cwd,
			addLog: io.addLog,
		});

		if (!result.ok) {
			io.addLog(
				`Warning: no se pudo abrir Simulator.app (exitCode ${result.exitCode ?? '—'})`,
			);
		}
	}

	{
		const result = await runStreamed({
			prefix: '[simctl]',
			file: 'xcrun',
			args: ['simctl', 'bootstatus', context.simulatorUdid, '-b'],
			cwd: io.cwd,
			addLog: io.addLog,
		});

		if (!result.ok) {
			io.addLog(`Boot: falló (exitCode ${result.exitCode ?? '—'})`);
			return;
		}
	}

	const derivedDataPath = getDerivedDataPath(io.cwd);
	await ensureDir(derivedDataPath);
	io.addLog(`DerivedData: ${derivedDataPath}`);

	{
		io.addLog('Build & Run: build…');
		const result = await runStreamed({
			prefix: '[xcodebuild]',
			file: 'xcodebuild',
			args: [
				'build',
				...getXcodebuildContainerArgs(context.container),
				'-scheme',
				context.scheme,
				'-destination',
				`id=${context.simulatorUdid}`,
				'-derivedDataPath',
				derivedDataPath,
			],
			cwd: io.cwd,
			addLog: io.addLog,
		});

		if (!result.ok) {
			io.addLog(`Build: falló (exitCode ${result.exitCode ?? '—'})`);
			return;
		}
	}

	const appPath = await findLatestAppInDerivedData(derivedDataPath);
	if (!appPath) {
		io.addLog('No se encontró ninguna .app en DerivedData/Build/Products.');
		return;
	}
	io.addLog(`.app: ${appPath}`);

	let bundleId: string;
	try {
		bundleId = await getBundleIdFromApp(appPath);
		io.addLog(`bundleId: ${bundleId}`);
	} catch (error) {
		io.addLog(`Error leyendo bundleId: ${String(error)}`);
		return;
	}

	{
		io.addLog('Install…');
		const result = await runStreamed({
			prefix: '[simctl]',
			file: 'xcrun',
			args: ['simctl', 'install', context.simulatorUdid, appPath],
			cwd: io.cwd,
			addLog: io.addLog,
		});

		if (!result.ok) {
			io.addLog(`Install: falló (exitCode ${result.exitCode ?? '—'})`);
			return;
		}
	}

	{
		io.addLog('Launch…');
		const result = await runStreamed({
			prefix: '[simctl]',
			file: 'xcrun',
			args: ['simctl', 'launch', context.simulatorUdid, bundleId],
			cwd: io.cwd,
			addLog: io.addLog,
		});

		if (!result.ok) {
			io.addLog(`Launch: falló (exitCode ${result.exitCode ?? '—'})`);
			return;
		}
	}

	io.addLog('Build & Run: OK');
}

