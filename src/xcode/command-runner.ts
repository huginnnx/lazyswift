import type {Readable} from 'node:stream';

import {execa} from 'execa';

type RunStreamedOptions = {
	prefix: string;
	file: string;
	args: string[];
	cwd?: string;
	addLog: (line: string) => void;
};

type RunCaptureOptions = {
	file: string;
	args: string[];
	cwd?: string;
};

function streamToLines(stream: Readable, onLine: (line: string) => void) {
	let buffer = '';

	const flush = () => {
		if (buffer.length === 0) return;
		onLine(buffer);
		buffer = '';
	};

	stream.on('data', chunk => {
		buffer += chunk.toString('utf8');
		let newlineIndex = buffer.indexOf('\n');
		while (newlineIndex >= 0) {
			const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
			onLine(line);
			buffer = buffer.slice(newlineIndex + 1);
			newlineIndex = buffer.indexOf('\n');
		}
	});

	stream.on('end', flush);
	stream.on('close', flush);
}

export async function runStreamed({
	prefix,
	file,
	args,
	cwd,
	addLog,
}: RunStreamedOptions): Promise<{ok: true} | {ok: false; exitCode: number | null}> {
	const cmdPreview = [file, ...args].join(' ');
	addLog(`${prefix} $ ${cmdPreview}`);

	const subprocess = execa(file, args, {
		cwd,
		reject: false,
		all: true,
	});

	if (subprocess.all) {
		streamToLines(subprocess.all, line => {
			if (line.trim().length === 0) return;
			addLog(`${prefix} ${line}`);
		});
	}

	const result = await subprocess;
	if (result.failed) return {ok: false, exitCode: result.exitCode ?? null};
	return {ok: true};
}

export async function runCapture({file, args, cwd}: RunCaptureOptions): Promise<{
	ok: true;
	stdout: string;
} | {ok: false; exitCode: number | null; stdout: string; stderr: string}> {
	const result = await execa(file, args, {cwd, reject: false});
	if (result.failed) {
		return {
			ok: false,
			exitCode: result.exitCode ?? null,
			stdout: result.stdout ?? '',
			stderr: result.stderr ?? '',
		};
	}

	return {ok: true, stdout: result.stdout ?? ''};
}

