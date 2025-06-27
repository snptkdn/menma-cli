import React, { useState } from 'react';
import { Text, Box } from 'ink';
import TextInput from 'ink-text-input';

/**
 * TagInput component for entering tags
 * @param {Object} props
 * @param {function(string[]): void} props.onSubmit - Callback when tags are submitted
 */
export default function TagInput({ onSubmit }) {
	const [value, setValue] = useState('');

	const handleSubmit = (input) => {
		// Split by comma and trim whitespace
		const tags = input
			.split(',')
			.map(tag => tag.trim())
			.filter(tag => tag.length > 0);
		
		onSubmit(tags);
	};

	return (
		<Box flexDirection="column">
			<Text>
				🏷️  <Text color="yellow">タグを入力してください (カンマ区切り、Enterで完了):</Text>
			</Text>
			<Box marginTop={1}>
				<Text color="gray">例: bug, urgent, frontend</Text>
			</Box>
			<Box marginTop={1}>
				<TextInput
					value={value}
					onChange={setValue}
					onSubmit={handleSubmit}
					placeholder="タグを入力..."
				/>
			</Box>
		</Box>
	);
}