import React from 'react';
import { Text, Box } from 'ink';
import SelectInput from 'ink-select-input';
import { padString, truncateString } from '../utils/textWidth.js';

/**
 * Format date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
	return date.toLocaleDateString('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}


/**
 * Create display label for file item
 * @param {import('../utils/fileScanner.js').FileInfo} file - File information
 * @returns {string} Display label
 */
function createFileLabel(file) {
	const title = truncateString(file.title || 'Untitled', 30);
	const project = truncateString(file.project || 'No Project', 15);
	const tags = file.tags.length > 0 ? file.tags.slice(0, 2).join(', ') : 'no tags';
	const tagsDisplay = truncateString(`[${tags}]`, 20);
	const date = formatDate(file.createdAt);
	
	// Format: "Title                    | Project     | [tags]         | 2023/12/01 10:30"
	return `${padString(title, 32)} | ${padString(project, 17)} | ${padString(tagsDisplay, 22)} | ${date}`;
}

/**
 * FileList component for displaying and selecting files
 * @param {Object} props
 * @param {import('../utils/fileScanner.js').FileInfo[]} props.files - Array of file information
 * @param {Object} props.filters - Active filters
 * @param {function(import('../utils/fileScanner.js').FileInfo): void} props.onSelect - Callback when file is selected
 * @param {string} [props.title] - Custom title for the list
 */
export default function FileList({ files, filters, onSelect, title }) {
	if (files.length === 0) {
		return (
			<Box flexDirection="column">
				<Text color="yellow">📂 ファイルが見つかりませんでした</Text>
				{filters.project && (
					<Text color="gray">プロジェクトフィルタ: {filters.project}</Text>
				)}
				{filters.tag && (
					<Text color="gray">タグフィルタ: {filters.tag}</Text>
				)}
				{filters.search && (
					<Text color="gray">検索キーワード: {filters.search}</Text>
				)}
			</Box>
		);
	}

	const items = files.map((file, index) => ({
		label: createFileLabel(file),
		value: file,
		key: `file-${index}`
	}));

	const handleSelect = (item) => {
		onSelect(item.value);
	};

	return (
		<Box flexDirection="column">
			<Text>
				<Text color="green">📋 menma-cli</Text> - {title || `ファイル一覧 (${files.length}件)`}
			</Text>
			
			{/* Display active filters */}
			{(filters.project || filters.tag || filters.search) && (
				<Box flexDirection="column" marginBottom={1}>
					<Text color="yellow">🔍 フィルタ条件:</Text>
					{filters.project && (
						<Text color="gray">  プロジェクト: {filters.project}</Text>
					)}
					{filters.tag && (
						<Text color="gray">  タグ: {filters.tag}</Text>
					)}
					{filters.search && (
						<Text color="gray">  検索: {filters.search}</Text>
					)}
				</Box>
			)}
			
			{/* Header */}
			<Box marginBottom={1}>
				<Text color="cyan">
					{padString('Title', 32)} | {padString('Project', 17)} | {padString('Tags', 22)} | {'Created'}
				</Text>
			</Box>
			<Box marginBottom={1}>
				<Text color="gray">
					{'-'.repeat(32)} | {'-'.repeat(17)} | {'-'.repeat(22)} | {'-'.repeat(16)}
				</Text>
			</Box>
			
			{/* File selection */}
			<Text color="yellow">↑↓ で選択, Enter で開く, Ctrl+C で終了</Text>
			<SelectInput items={items} onSelect={handleSelect} />
		</Box>
	);
}