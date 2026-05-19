import React, {useEffect, useMemo, useState} from 'react';
import {Box, render, Text, useApp, useInput, useStdin, useWindowSize} from 'ink';

import {findXcodeContainers} from './xcode/find-containers.js';
import type {ActiveContext} from './xcode/actions.js';
import {runBuild, runBuildAndRun} from './xcode/actions.js';
import {listSchemes} from './xcode/list-schemes.js';
import {listSimulators} from './xcode/list-simulators.js';
import {runtimeIdToLabel} from './xcode/runtime-label.js';
import type {SimulatorDevice, XcodeContainer} from './xcode/types.js';

type Focus = 'schemes' | 'simulators' | 'actions';
type SchemesPanelMode = 'select_container' | 'select_scheme';
type ViewMode = 'main' | 'logs';

type ActionId = 'build' | 'build_and_run';
type ActionItem = {
	id: ActionId;
	label: string;
};

type LogSource = 'xcodebuild' | 'simctl' | 'open' | 'app' | 'unknown';
type LogLevel = 'info' | 'warn' | 'error';
type LogEntry = {
	ts: number;
	source: LogSource;
	level: LogLevel;
	message: string;
};

function clampIndex(index: number, length: number): number {
	if (length <= 0) return 0;
	return Math.max(0, Math.min(index, length - 1));
}

function getWindowStartIndex({
	total,
	windowSize,
	selectedIndex,
}: {
	total: number;
	windowSize: number;
	selectedIndex: number;
}): number {
	if (total <= 0 || windowSize <= 0) return 0;
	if (total <= windowSize) return 0;

	const maxStart = total - windowSize;
	const desired = selectedIndex - Math.floor(windowSize / 2);
	return clampIndex(desired, maxStart + 1);
}

function formatContainerLabel(container: XcodeContainer): string {
	return `${container.type === 'workspace' ? '🧩' : '📁'} ${container.name}`;
}

type SimulatorRuntimeGroup = {
	runtimeId: string;
	runtimeLabel: string;
	devices: SimulatorDevice[];
};

type SimulatorVisibleRow =
	| {
			kind: 'runtime';
			runtimeId: string;
			runtimeLabel: string;
			count: number;
			isExpanded: boolean;
	  }
	| {
			kind: 'device';
			runtimeId: string;
			runtimeLabel: string;
			device: SimulatorDevice;
	  };

function Panel({
	title,
	children,
	isFocused,
}: {
	title: string;
	children: React.ReactNode;
	isFocused: boolean;
}) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor={isFocused ? 'cyan' : 'gray'}
			paddingX={1}
			paddingY={0}
			flexGrow={1}
		>
			<Text bold color={isFocused ? 'cyan' : undefined}>
				{title}
			</Text>
			<Box flexDirection="column" marginTop={1} flexGrow={1}>
				{children}
			</Box>
		</Box>
	);
}

function List({
	items,
	selectedIndex,
	emptyLabel,
	maxVisibleRows,
}: {
	items: string[];
	selectedIndex: number;
	emptyLabel: string;
	maxVisibleRows: number;
}) {
	if (items.length === 0) {
		return <Text dimColor>{emptyLabel}</Text>;
	}

	const windowSize = Math.max(1, maxVisibleRows);
	const start = getWindowStartIndex({
		total: items.length,
		windowSize,
		selectedIndex,
	});
	const end = Math.min(items.length, start + windowSize);
	const visible = items.slice(start, end);

	return (
		<Box flexDirection="column">
			{visible.map((item, relativeIndex) => {
				const index = start + relativeIndex;
				const isSelected = index === selectedIndex;
				return (
					<Text key={`${index}-${item}`} color={isSelected ? 'cyan' : undefined}>
						{isSelected ? '> ' : '  '}
						{item}
					</Text>
				);
			})}
			{items.length > windowSize ? (
				<Text dimColor>
					{start + 1}-{end} / {items.length}
				</Text>
			) : null}
		</Box>
	);
}

function formatTime(ts: number): string {
	const d = new Date(ts);
	const hh = String(d.getHours()).padStart(2, '0');
	const mm = String(d.getMinutes()).padStart(2, '0');
	const ss = String(d.getSeconds()).padStart(2, '0');
	return `${hh}:${mm}:${ss}`;
}

function parseLogLine(line: string): LogEntry {
	const ts = Date.now();
	const trimmed = line.trimEnd();

	const knownPrefixes: Array<{prefix: string; source: LogSource}> = [
		{prefix: '[xcodebuild]', source: 'xcodebuild'},
		{prefix: '[simctl]', source: 'simctl'},
		{prefix: '[open]', source: 'open'},
	];

	for (const {prefix, source} of knownPrefixes) {
		if (trimmed.startsWith(prefix)) {
			const message = trimmed.slice(prefix.length).trimStart();
			return {
				ts,
				source,
				level: inferLevel(message),
				message,
			};
		}
	}

	return {ts, source: 'app', level: inferLevel(trimmed), message: trimmed};
}

function inferLevel(message: string): LogLevel {
	const lower = message.toLowerCase();
	if (lower.includes(' error') || lower.includes('error:') || lower.includes('failed')) {
		return 'error';
	}
	if (lower.includes('warning:') || lower.includes(' warn') || lower.includes('deprecated')) {
		return 'warn';
	}
	return 'info';
}

function matchesFilter(entry: LogEntry, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (q.length === 0) return true;
	return entry.message.toLowerCase().includes(q);
}

function LogLine({
	entry,
	wrap,
}: {
	entry: LogEntry;
	wrap: 'wrap' | 'truncate-end';
}) {
	const sourceStyle =
		entry.source === 'xcodebuild'
			? {color: 'cyan' as const}
			: entry.source === 'simctl'
				? {color: 'magenta' as const}
				: entry.source === 'open'
					? {color: 'yellow' as const}
					: entry.source === 'app'
						? {color: 'gray' as const}
						: {color: 'white' as const};

	const levelStyle =
		entry.level === 'error'
			? {color: 'red' as const, dimColor: false}
			: entry.level === 'warn'
				? {color: 'yellow' as const, dimColor: false}
				: {color: undefined, dimColor: true};

	const sourceTag =
		entry.source === 'unknown' ? 'unknown' : entry.source;

	return (
		<Text {...levelStyle} wrap={wrap}>
			<Text dimColor>{formatTime(entry.ts)} </Text>
			<Text {...sourceStyle} bold>
				[{sourceTag}]
			</Text>{' '}
			{entry.message}
		</Text>
	);
}

function InputLayer({
	exit,
	focus,
	setFocus,
	schemesPanelMode,
	containers,
	containersIndex,
	setContainersIndex,
	setSelectedContainer,
	setSchemesPanelMode,
	schemes,
	schemeIndex,
	setSchemeIndex,
	setSelectedScheme,
	addLog,
	simulatorRowsLength,
	simulatorIndex,
	setSimulatorIndex,
	getSimulatorRowByIndex,
	setExpandedRuntimeId,
	setSelectedSimulatorUdid,
	actions,
	actionIndex,
	setActionIndex,
	activeContext,
	isActionRunning,
	setIsActionRunning,
	viewMode,
	setViewMode,
	logEntriesLength,
	setLogsScrollOffset,
	setIsFollowing,
	isFilterMode,
	setIsFilterMode,
	setFilterQuery,
}: {
	exit: () => void;
	focus: Focus;
	setFocus: React.Dispatch<React.SetStateAction<Focus>>;
	schemesPanelMode: SchemesPanelMode;
	containers: XcodeContainer[];
	containersIndex: number;
	setContainersIndex: React.Dispatch<React.SetStateAction<number>>;
	setSelectedContainer: React.Dispatch<React.SetStateAction<XcodeContainer | null>>;
	setSchemesPanelMode: React.Dispatch<React.SetStateAction<SchemesPanelMode>>;
	schemes: string[];
	schemeIndex: number;
	setSchemeIndex: React.Dispatch<React.SetStateAction<number>>;
	setSelectedScheme: React.Dispatch<React.SetStateAction<string | null>>;
	addLog: (line: string) => void;
	simulatorRowsLength: number;
	simulatorIndex: number;
	setSimulatorIndex: React.Dispatch<React.SetStateAction<number>>;
	getSimulatorRowByIndex: (index: number) => SimulatorVisibleRow | undefined;
	setExpandedRuntimeId: React.Dispatch<React.SetStateAction<string | null>>;
	setSelectedSimulatorUdid: React.Dispatch<React.SetStateAction<string | null>>;
	actions: ActionItem[];
	actionIndex: number;
	setActionIndex: React.Dispatch<React.SetStateAction<number>>;
	activeContext: ActiveContext | null;
	isActionRunning: boolean;
	setIsActionRunning: React.Dispatch<React.SetStateAction<boolean>>;
	viewMode: ViewMode;
	setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
	logEntriesLength: number;
	setLogsScrollOffset: React.Dispatch<React.SetStateAction<number>>;
	setIsFollowing: React.Dispatch<React.SetStateAction<boolean>>;
	isFilterMode: boolean;
	setIsFilterMode: React.Dispatch<React.SetStateAction<boolean>>;
	setFilterQuery: React.Dispatch<React.SetStateAction<string>>;
}) {
	useInput((input, key) => {
		if (input === 'q') {
			exit();
			return;
		}

		// Logs viewer mode takes over input
		if (viewMode === 'logs') {
			if (isFilterMode) {
				if (key.escape) {
					setIsFilterMode(false);
					return;
				}

				if (key.backspace || key.delete) {
					setFilterQuery(previous => previous.slice(0, -1));
					return;
				}

				if (key.return) {
					setIsFilterMode(false);
					return;
				}

				if (input && !key.ctrl && !key.meta) {
					setFilterQuery(previous => previous + input);
				}
				return;
			}

			if (key.escape) {
				setViewMode('main');
				return;
			}

			if (input === '/') {
				setIsFilterMode(true);
				return;
			}

			if (input === 'G' || key.end) {
				setLogsScrollOffset(0);
				setIsFollowing(true);
				return;
			}

			if (key.upArrow) {
				setLogsScrollOffset(previous => {
					const next = Math.min(previous + 1, Math.max(0, logEntriesLength));
					if (next > 0) setIsFollowing(false);
					return next;
				});
				return;
			}

			if (key.downArrow) {
				setLogsScrollOffset(previous => {
					const next = Math.max(0, previous - 1);
					if (next === 0) setIsFollowing(true);
					return next;
				});
				return;
			}

			return;
		}

		// Main view bindings
		if (key.escape) {
			exit();
			return;
		}

		if (input === 'L' || input === 'l') {
			setViewMode('logs');
			return;
		}

		if (key.tab) {
			setFocus(previous => {
				if (previous === 'schemes') return 'simulators';
				if (previous === 'simulators') return 'actions';
				return 'schemes';
			});
			return;
		}

		if (focus === 'actions') {
			if (key.upArrow) {
				setActionIndex(previous => clampIndex(previous - 1, actions.length));
			} else if (key.downArrow) {
				setActionIndex(previous => clampIndex(previous + 1, actions.length));
			} else if (key.return) {
				const action = actions[actionIndex];
				if (!action) return;

				if (isActionRunning) {
					addLog('Hay una acción en curso. Esperá a que termine.');
					return;
				}

				if (!activeContext) {
					addLog('Acción deshabilitada: seleccioná scheme y simulador.');
					return;
				}

				setIsActionRunning(true);
				void (async () => {
					try {
						if (action.id === 'build') {
							await runBuild(activeContext, {addLog, cwd: process.cwd()});
						} else if (action.id === 'build_and_run') {
							await runBuildAndRun(activeContext, {addLog, cwd: process.cwd()});
						}
					} catch (error) {
						addLog(`Acción falló: ${String(error)}`);
					} finally {
						setIsActionRunning(false);
					}
				})();
			}
			return;
		}

		if (focus === 'simulators') {
			if (key.upArrow) {
				setSimulatorIndex(previous =>
					clampIndex(previous - 1, simulatorRowsLength),
				);
			} else if (key.downArrow) {
				setSimulatorIndex(previous =>
					clampIndex(previous + 1, simulatorRowsLength),
				);
			} else if (key.return) {
				const row = getSimulatorRowByIndex(simulatorIndex);
				if (!row) {
					addLog('No hay simulador seleccionado.');
					return;
				}
				if (row.kind === 'runtime') {
					setExpandedRuntimeId(row.runtimeId);
					addLog(
						`Runtime activo: ${row.runtimeLabel} (${row.count} simuladores)`,
					);
					if (!row.isExpanded && row.count > 0) {
						setSimulatorIndex(clampIndex(simulatorIndex + 1, simulatorRowsLength));
					}
					return;
				}

				setSelectedSimulatorUdid(row.device.udid);
				addLog(`Simulator seleccionado: ${row.device.name} (${row.runtimeLabel})`);
			}
			return;
		}

		if (focus !== 'schemes') return;

		if (schemesPanelMode === 'select_container') {
			if (key.upArrow) {
				setContainersIndex(previous => clampIndex(previous - 1, containers.length));
			} else if (key.downArrow) {
				setContainersIndex(previous => clampIndex(previous + 1, containers.length));
			} else if (key.return) {
				const container = containers[containersIndex];
				if (!container) return;
				setSelectedContainer(container);
				setSchemesPanelMode('select_scheme');
			}
			return;
		}

		if (key.upArrow) {
			setSchemeIndex(previous => clampIndex(previous - 1, schemes.length));
		} else if (key.downArrow) {
			setSchemeIndex(previous => clampIndex(previous + 1, schemes.length));
		} else if (key.return) {
			const scheme = schemes[schemeIndex];
			if (scheme) {
				setSelectedScheme(scheme);
				addLog(`Scheme activo: ${scheme}`);
			} else {
				addLog('No hay scheme seleccionado.');
			}
		}
	});

	return null;
}

function App() {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {rows} = useWindowSize();

	const [focus, setFocus] = useState<Focus>('schemes');
	const [viewMode, setViewMode] = useState<ViewMode>('main');

	const maxLogEntries = 2000;
	const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
	const addLog = (line: string) => {
		setLogEntries(previous => {
			const next = [...previous, parseLogLine(line)];
			return next.length > maxLogEntries ? next.slice(-maxLogEntries) : next;
		});
	};

	const [logsScrollOffset, setLogsScrollOffset] = useState(0);
	const [isFollowing, setIsFollowing] = useState(true);
	const [isFilterMode, setIsFilterMode] = useState(false);
	const [filterQuery, setFilterQuery] = useState('');

	const [containers, setContainers] = useState<XcodeContainer[]>([]);
	const [containersIndex, setContainersIndex] = useState(0);
	const [selectedContainer, setSelectedContainer] = useState<XcodeContainer | null>(
		null,
	);

	const [schemes, setSchemes] = useState<string[]>([]);
	const [schemeIndex, setSchemeIndex] = useState(0);
	const [selectedScheme, setSelectedScheme] = useState<string | null>(null);
	const [schemesPanelMode, setSchemesPanelMode] =
		useState<SchemesPanelMode>('select_container');

	const [simulatorGroups, setSimulatorGroups] = useState<SimulatorRuntimeGroup[]>([]);
	const [simulatorIndex, setSimulatorIndex] = useState(0);
	const [expandedRuntimeId, setExpandedRuntimeId] = useState<string | null>(null);
	const [selectedSimulatorUdid, setSelectedSimulatorUdid] = useState<string | null>(
		null,
	);

	const actions: ActionItem[] = useMemo(
		() => [
			{id: 'build', label: 'Build'},
			{id: 'build_and_run', label: 'Build & Run'},
		],
		[],
	);
	const [actionIndex, setActionIndex] = useState(0);
	const [isActionRunning, setIsActionRunning] = useState(false);

	const [isLoading, setIsLoading] = useState(false);
	const containerLabels = useMemo(
		() => containers.map(formatContainerLabel),
		[containers],
	);

	useEffect(() => {
		let isCanceled = false;

		(async () => {
			setIsLoading(true);
			addLog(`Buscando .xcworkspace/.xcodeproj en ${process.cwd()}...`);

			try {
				const found = await findXcodeContainers({cwd: process.cwd()});
				if (isCanceled) return;

				setContainers(found);
				setContainersIndex(0);

				if (found.length === 0) {
					addLog('No se encontró ningún .xcworkspace ni .xcodeproj.');
					return;
				}

				if (found.length === 1) {
					addLog(`Usando ${formatContainerLabel(found[0])}`);
					setSelectedContainer(found[0]);
					setSchemesPanelMode('select_scheme');
				} else {
					addLog(`Encontrados ${found.length} contenedores. Elegí uno con Enter.`);
					setSchemesPanelMode('select_container');
				}
			} catch (error) {
				if (isCanceled) return;
				addLog(`Error buscando contenedores: ${String(error)}`);
			} finally {
				if (!isCanceled) setIsLoading(false);
			}
		})().catch(() => {});

		return () => {
			isCanceled = true;
		};
	}, []);

	useEffect(() => {
		let isCanceled = false;

		(async () => {
			setIsLoading(true);
			addLog('Leyendo simuladores (simctl)...');

			const result = await listSimulators();
			if (isCanceled) return;

			if (!result.ok) {
				addLog(result.error);
				if (result.stderr) addLog(result.stderr);
				setSimulatorGroups([]);
				setSimulatorIndex(0);
				setExpandedRuntimeId(null);
				return;
			}

			const groups: SimulatorRuntimeGroup[] = Object.entries(result.devicesByRuntime)
				.map(([runtimeId, devices]) => ({
					runtimeId,
					runtimeLabel: runtimeIdToLabel(runtimeId),
					devices,
				}))
				.sort((a, b) => {
					const byLabel = a.runtimeLabel.localeCompare(b.runtimeLabel, 'en', {
						numeric: true,
					});
					return byLabel !== 0 ? byLabel : a.runtimeId.localeCompare(b.runtimeId);
				});

			setSimulatorGroups(groups);
			setExpandedRuntimeId(previous => previous ?? groups[0]?.runtimeId ?? null);
			addLog(
				`Simulators: ${groups.reduce((acc, g) => acc + g.devices.length, 0)}`,
			);
		})()
			.catch(error => {
				if (isCanceled) return;
				addLog(`Error listando simuladores: ${String(error)}`);
			})
			.finally(() => {
				if (!isCanceled) setIsLoading(false);
			});

		return () => {
			isCanceled = true;
		};
	}, []);

	useEffect(() => {
		let isCanceled = false;
		if (!selectedContainer) return;

		(async () => {
			setIsLoading(true);
			addLog(`Leyendo schemes de ${formatContainerLabel(selectedContainer)}...`);

			const result = await listSchemes(selectedContainer);
			if (isCanceled) return;

			if (!result.ok) {
				addLog(result.error);
				if (result.stderr) addLog(result.stderr);
				setSchemes([]);
				setSchemeIndex(0);
				setSelectedScheme(null);
				return;
			}

			setSchemes(result.schemes);
			setSchemeIndex(0);
			setSelectedScheme(null);
			addLog(`Schemes: ${result.schemes.length}`);
		})()
			.catch(error => {
				if (isCanceled) return;
				addLog(`Error listando schemes: ${String(error)}`);
			})
			.finally(() => {
				if (!isCanceled) setIsLoading(false);
			});

		return () => {
			isCanceled = true;
		};
	}, [selectedContainer]);

	useEffect(() => {
		setActionIndex(previous => clampIndex(previous, actions.length));
	}, [actions.length]);

	useEffect(() => {
		if (!isRawModeSupported) {
			addLog(
				'Input deshabilitado: stdin no soporta raw mode (corré lazyswift desde una terminal real).',
			);
		}
	}, [isRawModeSupported]);

	const schemesTitle =
		schemesPanelMode === 'select_container'
			? 'Schemes (contenedor)'
			: selectedScheme
				? `Schemes (active: ${selectedScheme})`
				: 'Schemes';
	const schemesItems =
		schemesPanelMode === 'select_container' ? containerLabels : schemes;
	const schemesSelectedIndex =
		schemesPanelMode === 'select_container' ? containersIndex : schemeIndex;
	const schemesEmptyLabel =
		schemesPanelMode === 'select_container'
			? 'No hay contenedores detectados.'
			: selectedContainer
				? 'No hay schemes.'
				: 'Elegí un contenedor arriba.';

	const headerHeight = 1;
	const topHelpHeight = 1;
	const mainPanelsHeight = Math.max(10, Math.min(18, rows - 8));
	const logsPanelHeight = Math.max(6, rows - (headerHeight + topHelpHeight + mainPanelsHeight + 4));

	// Inside Panel: title (1) + marginTop (1) consumes 2 lines before list content.
	const listContentHeight = Math.max(1, mainPanelsHeight - 2 - 2);
	const logsContentHeight = Math.max(1, logsPanelHeight - 2);

	const filteredEntries = useMemo(
		() => logEntries.filter(e => matchesFilter(e, filterQuery)),
		[logEntries, filterQuery],
	);

	const logsToShow = useMemo(
		() => filteredEntries.slice(-logsContentHeight),
		[filteredEntries, logsContentHeight],
	);

	const simulatorVisibleRows = useMemo(() => {
		const rows: SimulatorVisibleRow[] = [];
		for (const group of simulatorGroups) {
			const isExpanded = group.runtimeId === expandedRuntimeId;
			rows.push({
				kind: 'runtime',
				runtimeId: group.runtimeId,
				runtimeLabel: group.runtimeLabel,
				count: group.devices.length,
				isExpanded,
			});

			if (isExpanded) {
				for (const device of group.devices) {
					rows.push({
						kind: 'device',
						runtimeId: group.runtimeId,
						runtimeLabel: group.runtimeLabel,
						device,
					});
				}
			}
		}
		return rows;
	}, [expandedRuntimeId, simulatorGroups]);

	useEffect(() => {
		setSimulatorIndex(previous => clampIndex(previous, simulatorVisibleRows.length));
	}, [simulatorVisibleRows.length]);

	const getSimulatorRowByIndex = (index: number) => simulatorVisibleRows[index];

	const activeContext: ActiveContext | null =
		selectedContainer && selectedScheme && selectedSimulatorUdid
			? {container: selectedContainer, scheme: selectedScheme, simulatorUdid: selectedSimulatorUdid}
			: null;

	useEffect(() => {
		// Keep scroll offset sane when buffer changes
		setLogsScrollOffset(previous => clampIndex(previous, Math.max(0, filteredEntries.length)));
	}, [filteredEntries.length]);

	useEffect(() => {
		if (!isFollowing) return;
		setLogsScrollOffset(0);
	}, [filteredEntries.length, isFollowing]);

	const viewerHeaderHeight = 3;
	const viewerContentHeight = Math.max(1, rows - viewerHeaderHeight - 2);
	const viewerStart = Math.max(
		0,
		filteredEntries.length - viewerContentHeight - logsScrollOffset,
	);
	const viewerEnd = Math.min(filteredEntries.length, viewerStart + viewerContentHeight);
	const viewerVisible = filteredEntries.slice(viewerStart, viewerEnd);

	return (
		<Box flexDirection="column" padding={1} gap={1}>
			{isRawModeSupported ? (
				<InputLayer
					exit={exit}
					focus={focus}
					setFocus={setFocus}
					schemesPanelMode={schemesPanelMode}
					containers={containers}
					containersIndex={containersIndex}
					setContainersIndex={setContainersIndex}
					setSelectedContainer={setSelectedContainer}
					setSchemesPanelMode={setSchemesPanelMode}
					schemes={schemes}
					schemeIndex={schemeIndex}
					setSchemeIndex={setSchemeIndex}
					setSelectedScheme={setSelectedScheme}
					addLog={addLog}
					simulatorRowsLength={simulatorVisibleRows.length}
					simulatorIndex={simulatorIndex}
					setSimulatorIndex={setSimulatorIndex}
					getSimulatorRowByIndex={getSimulatorRowByIndex}
					setExpandedRuntimeId={setExpandedRuntimeId}
					setSelectedSimulatorUdid={setSelectedSimulatorUdid}
					actions={actions}
					actionIndex={actionIndex}
					setActionIndex={setActionIndex}
					activeContext={activeContext}
					isActionRunning={isActionRunning}
					setIsActionRunning={setIsActionRunning}
					viewMode={viewMode}
					setViewMode={setViewMode}
					logEntriesLength={filteredEntries.length}
					setLogsScrollOffset={setLogsScrollOffset}
					setIsFollowing={setIsFollowing}
					isFilterMode={isFilterMode}
					setIsFilterMode={setIsFilterMode}
					setFilterQuery={setFilterQuery}
				/>
			) : null}

			{viewMode === 'logs' ? (
				<Box flexDirection="column" flexGrow={1}>
					<Box justifyContent="space-between">
						<Text bold>Logs</Text>
						<Text dimColor>
							↑↓ scroll · {isFollowing ? 'follow' : 'paused'} · / filter · G/End end · Esc back · q quit
						</Text>
					</Box>
					<Box justifyContent="space-between">
						<Text dimColor>
							Mostrando {viewerStart + 1}-{viewerEnd} / {filteredEntries.length}
						</Text>
						<Text dimColor>
							{filterQuery.trim().length > 0 ? `Filter: ${filterQuery}` : 'Filter: —'}
							{isFilterMode ? ' (typing)' : ''}
						</Text>
					</Box>
					<Box borderStyle="round" borderColor="gray" flexDirection="column" paddingX={1} flexGrow={1}>
						{viewerVisible.length === 0 ? (
							<Text dimColor>—</Text>
						) : (
							viewerVisible.map((entry, index) => (
								<LogLine key={`${entry.ts}-${index}-${entry.message}`} entry={entry} wrap="wrap" />
							))
						)}
					</Box>
				</Box>
			) : (
				<>
					<Box justifyContent="space-between" height={headerHeight}>
						<Text bold>lazyswift</Text>
						<Text dimColor>
							Tab cambia panel · ↑↓ navega · Enter selecciona · L logs · q/Esc sale
						</Text>
					</Box>

					<Box flexDirection="row" gap={1} height={mainPanelsHeight}>
						<Panel title={schemesTitle} isFocused={focus === 'schemes'}>
							{isLoading && <Text dimColor>Cargando…</Text>}
							<List
								items={schemesItems}
								selectedIndex={schemesSelectedIndex}
								emptyLabel={schemesEmptyLabel}
								maxVisibleRows={listContentHeight}
							/>
						</Panel>
						<Panel title="Simulators" isFocused={focus === 'simulators'}>
							{simulatorGroups.length === 0 ? (
								<Text dimColor>No hay simuladores disponibles.</Text>
							) : (
								<Box flexDirection="column">
									{(() => {
										const windowSize = Math.max(1, listContentHeight);
										const start = getWindowStartIndex({
											total: simulatorVisibleRows.length,
											windowSize,
											selectedIndex: simulatorIndex,
										});
										const end = Math.min(simulatorVisibleRows.length, start + windowSize);
										const visible = simulatorVisibleRows.slice(start, end);

										return (
											<>
												{visible.map((row, relativeIndex) => {
													const rowIndex = start + relativeIndex;
													const isFocused = focus === 'simulators';
													const isCursor = rowIndex === simulatorIndex;
													const showCursor = isFocused && isCursor;

													if (row.kind === 'runtime') {
														const arrow = row.isExpanded ? '▼' : '▶';
														const marker = showCursor ? '> ' : '  ';
														return (
															<Text
																key={`rt-${row.runtimeId}`}
																bold
																color={showCursor ? 'cyan' : undefined}
																inverse={showCursor}
															>
																{marker}
																{arrow} {row.runtimeLabel}{' '}
																<Text dimColor>({row.count})</Text>
															</Text>
														);
													}

													const isSelected = row.device.udid === selectedSimulatorUdid;
													const marker = showCursor ? '> ' : '  ';
													return (
														<Text
															key={row.device.udid}
															color={showCursor ? 'cyan' : isSelected ? 'green' : undefined}
															inverse={showCursor}
														>
															{marker}
															{row.device.name}{' '}
															<Text dimColor>
																{String(row.device.state ?? 'Unknown')}
															</Text>
														</Text>
													);
												})}
												{simulatorVisibleRows.length > windowSize ? (
													<Text dimColor>
														{start + 1}-{end} / {simulatorVisibleRows.length}
													</Text>
												) : null}
											</>
										);
									})()}
								</Box>
							)}
						</Panel>
						<Panel title="Actions" isFocused={focus === 'actions'}>
							<Box flexDirection="column">
								{actions.length === 0 ? (
									<Text dimColor>—</Text>
								) : (
									(() => {
										const windowSize = Math.max(1, listContentHeight);
										const start = getWindowStartIndex({
											total: actions.length,
											windowSize,
											selectedIndex: actionIndex,
										});
										const end = Math.min(actions.length, start + windowSize);
										const visible = actions.slice(start, end);

										return (
											<>
												{visible.map((action, relativeIndex) => {
													const index = start + relativeIndex;
													const showCursor = focus === 'actions' && index === actionIndex;
													const isEnabled = Boolean(activeContext) && !isActionRunning;
													const marker = showCursor ? '> ' : '  ';

													return (
														<Text
															key={action.id}
															color={showCursor ? 'cyan' : undefined}
															inverse={showCursor}
															dimColor={!isEnabled}
														>
															{marker}
															{action.label}
															{isActionRunning ? (
																<Text dimColor> (running)</Text>
															) : null}
														</Text>
													);
												})}
												{actions.length > windowSize ? (
													<Text dimColor>
														{start + 1}-{end} / {actions.length}
													</Text>
												) : null}
											</>
										);
									})()
								)}
								{activeContext ? (
									<Text dimColor>OK: scheme+simulator seleccionados</Text>
								) : (
									<Text dimColor>Falta: scheme y/o simulador</Text>
								)}
							</Box>
						</Panel>
					</Box>

					<Box
						flexDirection="column"
						borderStyle="round"
						borderColor="gray"
						paddingX={1}
						height={logsPanelHeight}
					>
						<Text bold>
							Logs
							{filterQuery.trim().length > 0 ? (
								<Text dimColor>{` (filter: ${filterQuery})`}</Text>
							) : null}
						</Text>
						<Box flexDirection="column" marginTop={1}>
							{logsToShow.length === 0 ? (
								<Text dimColor>—</Text>
							) : (
								logsToShow.map((entry, index) => (
									<LogLine
										key={`${entry.ts}-${index}-${entry.message}`}
										entry={entry}
										wrap="truncate-end"
									/>
								))
							)}
						</Box>
					</Box>
				</>
			)}
		</Box>
	);
}

render(<App />);

