import React, {useEffect, useMemo, useState} from 'react';
import {Box, render, Text, useApp, useInput, useStdin, useWindowSize} from 'ink';

import {findXcodeContainers} from './xcode/find-containers.js';
import {listSchemes} from './xcode/list-schemes.js';
import {listSimulators} from './xcode/list-simulators.js';
import {runtimeIdToLabel} from './xcode/runtime-label.js';
import type {SimulatorDevice, XcodeContainer} from './xcode/types.js';

type Focus = 'schemes' | 'simulators' | 'actions';
type SchemesPanelMode = 'select_container' | 'select_scheme';

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
	addLog,
	simulatorRowsLength,
	simulatorIndex,
	setSimulatorIndex,
	getSimulatorRowByIndex,
	setExpandedRuntimeId,
	setSelectedSimulatorUdid,
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
	addLog: (line: string) => void;
	simulatorRowsLength: number;
	simulatorIndex: number;
	setSimulatorIndex: React.Dispatch<React.SetStateAction<number>>;
	getSimulatorRowByIndex: (index: number) => SimulatorVisibleRow | undefined;
	setExpandedRuntimeId: React.Dispatch<React.SetStateAction<string | null>>;
	setSelectedSimulatorUdid: React.Dispatch<React.SetStateAction<string | null>>;
}) {
	useInput((input, key) => {
		if (input === 'q' || key.escape) {
			exit();
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
			if (scheme) addLog(`Scheme seleccionado: ${scheme}`);
			else addLog('No hay scheme seleccionado.');
		}
	});

	return null;
}

function App() {
	const {exit} = useApp();
	const {isRawModeSupported} = useStdin();
	const {rows} = useWindowSize();

	const [focus, setFocus] = useState<Focus>('schemes');
	const [logs, setLogs] = useState<string[]>([]);
	const addLog = (line: string) => {
		setLogs(previous => {
			const next = [...previous, line];
			return next.length > 200 ? next.slice(-200) : next;
		});
	};

	const [containers, setContainers] = useState<XcodeContainer[]>([]);
	const [containersIndex, setContainersIndex] = useState(0);
	const [selectedContainer, setSelectedContainer] = useState<XcodeContainer | null>(
		null,
	);

	const [schemes, setSchemes] = useState<string[]>([]);
	const [schemeIndex, setSchemeIndex] = useState(0);
	const [schemesPanelMode, setSchemesPanelMode] =
		useState<SchemesPanelMode>('select_container');

	const [simulatorGroups, setSimulatorGroups] = useState<SimulatorRuntimeGroup[]>([]);
	const [simulatorIndex, setSimulatorIndex] = useState(0);
	const [expandedRuntimeId, setExpandedRuntimeId] = useState<string | null>(null);
	const [selectedSimulatorUdid, setSelectedSimulatorUdid] = useState<string | null>(
		null,
	);

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
				return;
			}

			setSchemes(result.schemes);
			setSchemeIndex(0);
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
		if (!isRawModeSupported) {
			addLog(
				'Input deshabilitado: stdin no soporta raw mode (corré lazyswift desde una terminal real).',
			);
		}
	}, [isRawModeSupported]);

	const schemesTitle =
		schemesPanelMode === 'select_container' ? 'Schemes (contenedor)' : 'Schemes';
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

	const logsToShow = useMemo(
		() => logs.slice(-logsContentHeight),
		[logs, logsContentHeight],
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
					addLog={addLog}
					simulatorRowsLength={simulatorVisibleRows.length}
					simulatorIndex={simulatorIndex}
					setSimulatorIndex={setSimulatorIndex}
					getSimulatorRowByIndex={getSimulatorRowByIndex}
					setExpandedRuntimeId={setExpandedRuntimeId}
					setSelectedSimulatorUdid={setSelectedSimulatorUdid}
				/>
			) : null}
			<Box justifyContent="space-between" height={headerHeight}>
				<Text bold>lazyswift</Text>
				<Text dimColor>
					Tab cambia panel · ↑↓ navega · Enter selecciona · q/Esc sale
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
					<Text dimColor>(próximo) Build · Test · Boot · Logs</Text>
				</Panel>
			</Box>

			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				height={logsPanelHeight}
			>
				<Text bold>Logs</Text>
				<Box flexDirection="column" marginTop={1}>
					{logsToShow.length === 0 ? (
						<Text dimColor>—</Text>
					) : (
						logsToShow.map((line, index) => (
							<Text key={`${index}-${line}`} dimColor>
								{line}
							</Text>
						))
					)}
				</Box>
			</Box>
		</Box>
	);
}

render(<App />);

