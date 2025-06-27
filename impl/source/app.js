import { useState, useEffect, useCallback } from 'react';
import { Text, Box } from 'ink';
import { loadConfig } from './utils/configLoader.js';
import { generateFile, openFile } from './utils/fileGenerator.js';
import { listFiles } from './utils/fileScanner.js';
import { getSmartSuggestions } from './utils/accessTracker.js';
import { moveToTrash } from './utils/trash.js';
import FormatSelector from './components/FormatSelector.js';
import TagInput from './components/TagInput.js';
import FileList from './components/FileList.js';

const STEPS = {
	LOADING: 'loading',
	FORMAT_SELECTION: 'format_selection',
	TAG_INPUT: 'tag_input',
	GENERATING: 'generating',
	COMPLETED: 'completed',
	FILE_LIST: 'file_list',
	OPENING_FILE: 'opening_file',
	ERROR: 'error'
};

export default function App({ command, title, project, filters = {}, count = 5 }) {
	const [step, setStep] = useState(STEPS.LOADING);
	const [config, setConfig] = useState(null);
	const [selectedFormat, setSelectedFormat] = useState(null);
	const [tags, setTags] = useState([]);
	const [files, setFiles] = useState([]);
	const [error, setError] = useState(null);
	const [generatedFilePath, setGeneratedFilePath] = useState('');

	// Load configuration on mount
	useEffect(() => {
		loadConfig()
			.then(config => {
				setConfig(config);
				if (command === 'add') {
					setStep(STEPS.FORMAT_SELECTION);
				} else if (command === 'ls') {
					loadFileList(config);
				} else if (command === 'recent') {
					loadRecentFiles(config);
				} else if (command === 'smart') {
					loadSmartSuggestions(config);
				}
			})
			.catch(err => {
				setError(`設定ファイルの読み込みに失敗しました: ${err.message}`);
				setStep(STEPS.ERROR);
			});
	}, [command, count]);

	// Load file list for ls command
	const loadFileList = async (config) => {
		try {
			const fileList = await listFiles(config.baseDir, filters);
			setFiles(fileList);
			setStep(STEPS.FILE_LIST);
		} catch (err) {
			setError(`ファイル一覧の取得に失敗しました: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	};

	// Load recent files for recent command
	const loadRecentFiles = async (config) => {
		try {
			const fileList = await listFiles(config.baseDir);
			const recentFiles = fileList.slice(0, count);
			setFiles(recentFiles);
			setStep(STEPS.FILE_LIST);
		} catch (err) {
			setError(`最近のファイル取得に失敗しました: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	};

	// Load smart suggestions for smart command
	const loadSmartSuggestions = async (config) => {
		try {
			const fileList = await listFiles(config.baseDir);
			const suggestions = await getSmartSuggestions(fileList, count);
			// Extract just the file objects for FileList component
			const smartFiles = suggestions.map(s => s.file);
			setFiles(smartFiles);
			setStep(STEPS.FILE_LIST);
		} catch (err) {
			setError(`スマート提案の取得に失敗しました: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	};

	// Handle format selection (add mode)
	const handleFormatSelect = (format) => {
		setSelectedFormat(format);
		setStep(STEPS.TAG_INPUT);
	};

	// Handle tag input (add mode)
	const handleTagSubmit = async (inputTags) => {
		setTags(inputTags);
		setStep(STEPS.GENERATING);

		try {
			const fileData = {
				title,
				project,
				tags: inputTags,
				date: new Date().toLocaleString('ja-JP'),
				format: selectedFormat
			};

			const filePath = await generateFile(fileData, config);
			setGeneratedFilePath(filePath);

			// Try to open the file
			try {
				await openFile(filePath, config.editorCommand);
			} catch (openError) {
				console.warn(`ファイルを開けませんでした: ${openError.message}`);
			}

			setStep(STEPS.COMPLETED);
		} catch (err) {
			setError(`ファイル生成に失敗しました: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	};

	// Handle file selection (ls mode)
	const handleFileSelect = async (file) => {
		setStep(STEPS.OPENING_FILE);
		try {
			await openFile(file.filePath, config.editorCommand);
			// Exit after opening file
			process.exit(0);
		} catch (err) {
			setError(`ファイルを開けませんでした: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	};

	// Handle file trash (ls mode)
	const handleFileTrash = useCallback(async (file) => {
		if (!config) {
			return;
		}
		try {
			await moveToTrash(file.filePath, config.baseDir);
			// Reload file list after trashing
			if (command === 'ls') {
				await loadFileList(config);
			} else if (command === 'recent') {
				await loadRecentFiles(config);
			} else if (command === 'smart') {
				await loadSmartSuggestions(config);
			}
		} catch (err) {
			setError(`ファイルをゴミ箱に移動できませんでした: ${err.message}`);
			setStep(STEPS.ERROR);
		}
	}, [config, command, loadFileList, loadRecentFiles, loadSmartSuggestions]);

	// Render based on current step
	switch (step) {
		case STEPS.LOADING:
			return (
				<Box>
					<Text color="blue">⏳ 設定を読み込み中...</Text>
				</Box>
			);

		case STEPS.FORMAT_SELECTION:
			return (
				<Box flexDirection="column">
					<Text>
						<Text color="green">📋 menma-cli</Text> - ファイル管理ツール
					</Text>
					<Text>
						タイトル: <Text color="cyan">{title}</Text>
					</Text>
					<Text>
						プロジェクト: <Text color="magenta">{project}</Text>
					</Text>
					<Text></Text>
					<FormatSelector formats={config.formats} onSelect={handleFormatSelect} />
				</Box>
			);

		case STEPS.TAG_INPUT:
			return (
				<Box flexDirection="column">
					<Text>
						フォーマット: <Text color="green">{selectedFormat.name}</Text>
					</Text>
					<Text></Text>
					<TagInput onSubmit={handleTagSubmit} />
				</Box>
			);

		case STEPS.GENERATING:
			return (
				<Box>
					<Text color="yellow">⚡ ファイルを生成中...</Text>
				</Box>
			);

		case STEPS.COMPLETED:
			return (
				<Box flexDirection="column">
					<Text color="green">✅ ファイルが正常に生成されました!</Text>
					<Text>
						📄 ファイルパス: <Text color="blue">{generatedFilePath}</Text>
					</Text>
					<Text>
						🏷️  タグ: <Text color="yellow">{tags.length > 0 ? tags.join(', ') : 'なし'}</Text>
					</Text>
					<Text></Text>
					<Text color="gray">エディタでファイルを開こうとしました。</Text>
				</Box>
			);

		case STEPS.FILE_LIST:
			return (
				<FileList
					files={files}
					filters={['recent', 'smart'].includes(command) ? {} : filters}
					onSelect={handleFileSelect}
					onDelete={handleFileTrash}
					title={
						command === 'recent' ? `📅 Recent ${count} files` :
						command === 'smart' ? `🧠 Smart suggestions (${count} files)` :
						undefined
					}
				/>
			);

		case STEPS.OPENING_FILE:
			return (
				<Box>
					<Text color="blue">📂 ファイルを開いています...</Text>
				</Box>
			);

		case STEPS.ERROR:
			return (
				<Box flexDirection="column">
					<Text color="red">❌ エラーが発生しました</Text>
					<Text color="red">{error}</Text>
				</Box>
			);

		default:
			return (
				<Box>
					<Text color="red">不明な状態です</Text>
				</Box>
			);
	}
}
