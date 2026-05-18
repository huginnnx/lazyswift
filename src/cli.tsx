import React, {useEffect, useMemo, useState} from 'react';
import {Box, render, Text, useApp, useInput, useStdin} from 'ink';

import {findXcodeContainers} from './xcode/find-containers.js';
import {listSchemes} from './xcode/list-schemes.js';
import type {XcodeContainer} from './xcode/types.js';

type Focus = 'schemes' | 'simulators' | 'actions';
type SchemesPanelMode = 'select_container' | 'select_scheme';

function clampIndex(index: number, length: number): number {
	if (length <= 0) return 0;
	return Math.max(0, Math.min(index, length - 1));
}

function formatContainerLabel(container: XcodeContainer): string {
	return `${container.type === 'workspace' ? '🧩' : '📁'} ${container.name}`;
}

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
}: {
	items: string[];
	selectedIndex: number;
	emptyLabel: string;
}) {
	if (items.length === 0) {
		return <Text dimColor>{emptyLabel}</Text>;
	}

	return (
		<Box flexDirection="column">
			{items.map((item, index) => {
				const isSelected = index === selectedIndex;
				return (
					<Text key={`${index}-${item}`} color={isSelected ? 'cyan' : undefined}>
						{isSelected ? '> ' : '  '}
						{item}
					</Text>
				);
			})}
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

	const logsToShow = useMemo(() => logs.slice(-12), [logs]);

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
				/>
			) : null}
			<Box justifyContent="space-between">
				<Text bold>lazyswift</Text>
				<Text dimColor>
					Tab cambia panel · ↑↓ navega · Enter selecciona · q/Esc sale
				</Text>
			</Box>

			<Box flexDirection="row" gap={1}>
				<Panel title={schemesTitle} isFocused={focus === 'schemes'}>
					{isLoading && <Text dimColor>Cargando…</Text>}
					<List
						items={schemesItems}
						selectedIndex={schemesSelectedIndex}
						emptyLabel={schemesEmptyLabel}
					/>
				</Panel>
				<Panel title="Simulators" isFocused={focus === 'simulators'}>
					<Text dimColor>(próximo) `xcrun simctl list -j devices`</Text>
				</Panel>
				<Panel title="Actions" isFocused={focus === 'actions'}>
					<Text dimColor>(próximo) Build · Test · Boot · Logs</Text>
				</Panel>
			</Box>

			<Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
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

