import {execa} from 'execa';

import type {SimulatorsListResult, SimulatorsByRuntime} from './types.js';

type SimctlListDevicesJson = {
	devices?: SimulatorsByRuntime;
};

export async function listSimulators(): Promise<SimulatorsListResult> {
	if (process.platform !== 'darwin') {
		return {ok: false, error: 'simctl solo está disponible en macOS.'};
	}

	const result =
		await execa({reject: false, all: true})`xcrun simctl list -j devices available`;

	if (result.failed) {
		return {
			ok: false,
			error: `simctl falló (exitCode ${result.exitCode ?? '—'})`,
			stderr: result.all || result.stderr,
		};
	}

	try {
		const parsed = JSON.parse(result.stdout) as SimctlListDevicesJson;
		const devicesByRuntime = parsed.devices ?? {};
		return {ok: true, devicesByRuntime};
	} catch (error) {
		return {
			ok: false,
			error: 'No se pudo parsear JSON de simctl.',
			stderr: String(error),
		};
	}
}

