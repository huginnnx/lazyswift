import React, {useState} from 'react';
import {Box, render, Text, useApp, useInput} from 'ink';

function App() {
	const {exit} = useApp();
	const [lastKey, setLastKey] = useState<string>('');

	useInput((input, key) => {
		if (input === 'q' || key.escape) {
			exit();
			return;
		}

		if (key.return) setLastKey('Enter');
		else if (key.tab) setLastKey('Tab');
		else if (key.upArrow) setLastKey('↑');
		else if (key.downArrow) setLastKey('↓');
		else if (key.leftArrow) setLastKey('←');
		else if (key.rightArrow) setLastKey('→');
		else if (input) setLastKey(input);
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Text bold>lazyswift</Text>
			<Text dimColor>Presioná 'q' o Esc para salir.</Text>
			<Box marginTop={1} flexDirection="column">
				<Text>
					Última tecla: <Text color="cyan">{lastKey || '—'}</Text>
				</Text>
			</Box>
		</Box>
	);
}

render(<App />);

