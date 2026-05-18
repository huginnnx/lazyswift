export type XcodeContainerType = 'workspace' | 'project';

export type XcodeContainer = {
	type: XcodeContainerType;
	path: string;
	name: string;
};

export type SchemesListResult =
	| {
			ok: true;
			schemes: string[];
	  }
	| {
			ok: false;
			error: string;
			stderr?: string;
	  };

export type SimulatorState =
	| 'Booted'
	| 'Shutdown'
	| 'Shutting Down'
	| 'Creating'
	| 'Booting'
	| 'Unknown';

export type SimulatorDevice = {
	udid: string;
	name: string;
	state: SimulatorState | string;
	isAvailable?: boolean;
	logPath?: string;
	deviceTypeIdentifier?: string;
};

export type SimulatorsByRuntime = Record<string, SimulatorDevice[]>;

export type SimulatorsListResult =
	| {
			ok: true;
			devicesByRuntime: SimulatorsByRuntime;
	  }
	| {
			ok: false;
			error: string;
			stderr?: string;
	  };

