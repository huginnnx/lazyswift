export function runtimeIdToLabel(runtimeId: string): string {
	const marker = 'com.apple.CoreSimulator.SimRuntime.';
	const raw = runtimeId.startsWith(marker) ? runtimeId.slice(marker.length) : runtimeId;

	// Expected shapes: iOS-26-1, iOS-18-0, watchOS-11-0, tvOS-18-0, visionOS-2-0, xrOS-2-0, etc.
	const parts = raw.split('-').filter(Boolean);
	if (parts.length >= 2) {
		const platform = parts[0];
		const versionParts = parts.slice(1).filter(p => /^\d+$/.test(p));
		if (versionParts.length > 0) {
			return `${platform} ${versionParts.join('.')}`;
		}
	}

	return raw;
}

