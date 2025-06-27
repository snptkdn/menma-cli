import { Text, Box } from 'ink';
import SelectInput from 'ink-select-input';

/**
 * FormatSelector component for choosing file format
 * @param {Object} props
 * @param {import('../types.js').Format[]} props.formats - Available formats
 * @param {function(import('../types.js').Format): void} props.onSelect - Callback when format is selected
 */
export default function FormatSelector({ formats, onSelect }) {
	const items = formats.map((format, index) => ({
		label: format.name,
		value: format,
		key: `format-${index}`
	}));

	const handleSelect = (item) => {
		onSelect(item.value);
	};

	return (
		<Box flexDirection="column">
			<Text>
				📝 <Text color="cyan">フォーマットを選択してください:</Text>
			</Text>
			<SelectInput items={items} onSelect={handleSelect} />
		</Box>
	);
}