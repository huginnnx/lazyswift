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

