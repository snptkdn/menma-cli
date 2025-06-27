#!/usr/bin/env node
import {render} from 'ink';
import meow from 'meow';
import path from 'path';
import App from './app.js';
import { padString, truncateString } from './utils/textWidth.js';

const cli = meow(
	`
		Usage
		  $ menma add <title> <project>
		  $ menma ls [options]
		  $ menma open <title>
		  $ menma recent [count]
		  $ menma smart [count]
		  $ menma tags [options]
		  $ menma stats

		Options
			--help       Show this help
			--project    Filter by project name
			--tag        Filter by tag
			--search     Search in file content
			--count      Show tag usage counts

		Examples
		  $ menma add "Meeting Notes" "ProjectX"
		  $ menma ls
		  $ menma ls --project "ProjectX"
		  $ menma open "Meeting Notes"
		  $ menma recent 5
		  $ menma smart 10
		  $ menma tags
		  $ menma tags --count
		  $ menma stats
	`,
	{
		importMeta: import.meta,
		flags: {
			help: {
				type: 'boolean',
				alias: 'h'
			},
			project: {
				type: 'string',
				alias: 'p'
			},
			tag: {
				type: 'string',
				alias: 't'
			},
			search: {
				type: 'string',
				alias: 's'
			},
			count: {
				type: 'boolean',
				alias: 'c'
			}
		}
	},
);

const command = cli.input[0];

if (!command || !['add', 'ls', 'open', 'recent', 'smart', 'tags', 'stats'].includes(command)) {
	console.log('Error: Please specify a valid command: add, ls, open, recent, smart, tags, or stats');
	cli.showHelp();
	process.exit(1);
}

let appProps = { command };

if (command === 'add') {
	if (cli.input.length < 3) {
		console.log('Error: Please use "menma add <title> <project>" format');
		cli.showHelp();
		process.exit(1);
	}
	const [, title, project] = cli.input;
	appProps = { ...appProps, title, project };
} else if (command === 'ls') {
	appProps = {
		...appProps,
		filters: {
			project: cli.flags.project,
			tag: cli.flags.tag,
			search: cli.flags.search
		}
	};
} else if (command === 'open') {
	if (cli.input.length < 2) {
		console.log('Error: Please specify a file title to open');
		cli.showHelp();
		process.exit(1);
	}
	const [, title] = cli.input;
	appProps = { ...appProps, title };
} else if (command === 'recent') {
	const count = parseInt(cli.input[1]) || 5;
	appProps = { ...appProps, count };
} else if (command === 'smart') {
	const count = parseInt(cli.input[1]) || 10;
	appProps = { ...appProps, count };
} else if (command === 'tags') {
	appProps = { ...appProps, showCount: cli.flags.count };
}

// Check if command requires interactive mode
const interactiveCommands = ['add', 'ls', 'recent', 'smart'];
const nonInteractiveCommands = ['open', 'tags', 'stats'];

if (nonInteractiveCommands.includes(command) || process.env.NODE_ENV === 'test' || !process.stdin.isTTY) {
	// Non-interactive mode
	if (command === 'ls') {
		const { loadConfig } = await import('./utils/configLoader.js');
		const { listFiles } = await import('./utils/fileScanner.js');
		
		try {
			const config = await loadConfig();
			const files = await listFiles(config.baseDir, appProps.filters);
			
			console.log(`\n📋 menma-cli - Found ${files.length} files\n`);
			
			if (files.length === 0) {
				console.log('📂 No files found.');
				if (appProps.filters.project) console.log(`Project filter: ${appProps.filters.project}`);
				if (appProps.filters.tag) console.log(`Tag filter: ${appProps.filters.tag}`);
				if (appProps.filters.search) console.log(`Search filter: ${appProps.filters.search}`);
			} else {
				console.log(padString('Title', 32) + ' | ' + padString('Project', 17) + ' | ' + padString('Tags', 22) + ' | ' + 'Created');
				console.log('-'.repeat(32) + ' | ' + '-'.repeat(17) + ' | ' + '-'.repeat(22) + ' | ' + '-'.repeat(16));
				
				files.forEach(file => {
					const title = truncateString(file.title || 'Untitled', 30);
					const project = truncateString(file.project || 'No Project', 15);
					const tags = file.tags.length > 0 ? `[${file.tags.slice(0, 2).join(', ')}]` : '[no tags]';
					const tagsDisplay = truncateString(tags, 20);
					const date = file.createdAt.toLocaleDateString('ja-JP', {
						year: 'numeric',
						month: '2-digit',
						day: '2-digit',
						hour: '2-digit',
						minute: '2-digit'
					});
					
					console.log(`${padString(title, 32)} | ${padString(project, 17)} | ${padString(tagsDisplay, 22)} | ${date}`);
				});
			}
		} catch (error) {
			console.error(`Error: ${error.message}`);
		}
		process.exit(0);
	} else if (command === 'open' || command === 'tags' || command === 'stats') {
		const { loadConfig } = await import('./utils/configLoader.js');
		const { listFiles } = await import('./utils/fileScanner.js');
		const { openFile } = await import('./utils/fileGenerator.js');
		
		try {
			const config = await loadConfig();
			const files = await listFiles(config.baseDir);
			
			if (command === 'open') {
				const searchTitle = appProps.title.toLowerCase();
				const matchingFiles = files.filter(file => 
					file.title.toLowerCase().includes(searchTitle)
				);
				
				if (matchingFiles.length === 0) {
					console.log(`📂 No files found with title containing: "${appProps.title}"`);
					process.exit(1);
				} else if (matchingFiles.length === 1) {
					console.log(`📂 Opening: ${matchingFiles[0].title}`);
					await openFile(matchingFiles[0].filePath, config.editorCommand);
				} else {
					console.log(`\n🔍 Multiple files found for "${appProps.title}":\n`);
					matchingFiles.forEach((file, index) => {
						console.log(`${index + 1}. ${file.title} (${file.project})`);
					});
					console.log('\nPlease be more specific.');
				}
			} else if (command === 'tags') {
				// Collect all tags and their usage counts
				const tagStats = new Map();
				files.forEach(file => {
					file.tags.forEach(tag => {
						tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
					});
				});
				
				if (tagStats.size === 0) {
					console.log('📂 No tags found.');
				} else {
					const sortedTags = Array.from(tagStats.entries()).sort((a, b) => b[1] - a[1]);
					
					if (appProps.showCount) {
						console.log(`\n🏷️  Tag usage statistics (${tagStats.size} unique tags):\n`);
						sortedTags.forEach(([tag, count]) => {
							console.log(`${padString(tag, 20)} ${count} files`);
						});
					} else {
						console.log(`\n🏷️  All tags (${tagStats.size} unique):\n`);
						const tags = sortedTags.map(([tag]) => tag);
						// Display tags in columns
						const columns = 3;
						for (let i = 0; i < tags.length; i += columns) {
							const row = tags.slice(i, i + columns);
							console.log(row.map(tag => padString(tag, 20)).join(''));
						}
					}
				}
			} else if (command === 'stats') {
				const { getAccessStats } = await import('./utils/accessTracker.js');
				const accessStats = await getAccessStats();
				
				console.log('\n📊 Access Statistics:\n');
				console.log(`Files tracked: ${accessStats.totalFiles}`);
				console.log(`Total accesses: ${accessStats.totalAccesses}`);
				
				if (accessStats.mostAccessed) {
					const mostAccessed = accessStats.mostAccessed;
					const fileName = path.basename(mostAccessed.filePath);
					console.log(`Most accessed: ${fileName} (${mostAccessed.accessCount} times)`);
				}
				console.log('');
				
				// Generate comprehensive file statistics  
				const projectStats = new Map();
				const tagStats = new Map();
				const formatStats = new Map();
				const today = new Date();
				const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
				const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
				
				let recentWeekCount = 0;
				let recentMonthCount = 0;
				
				files.forEach(file => {
					// Project stats
					projectStats.set(file.project, (projectStats.get(file.project) || 0) + 1);
					
					// Tag stats
					file.tags.forEach(tag => {
						tagStats.set(tag, (tagStats.get(tag) || 0) + 1);
					});
					
					// Format stats
					formatStats.set(file.extension, (formatStats.get(file.extension) || 0) + 1);
					
					// Time-based stats
					if (file.createdAt > thisWeek) recentWeekCount++;
					if (file.createdAt > thisMonth) recentMonthCount++;
				});
				
				console.log('📊 File Statistics\n');
				console.log(`Total files: ${files.length}`);
				console.log(`Files this week: ${recentWeekCount}`);
				console.log(`Files this month: ${recentMonthCount}`);
				console.log(`Unique projects: ${projectStats.size}`);
				console.log(`Unique tags: ${tagStats.size}`);
				
				// Top projects
				if (projectStats.size > 0) {
					console.log('\n📁 Top Projects:');
					const topProjects = Array.from(projectStats.entries())
						.sort((a, b) => b[1] - a[1])
						.slice(0, 5);
					topProjects.forEach(([project, count]) => {
						console.log(`  ${project}: ${count} files`);
					});
				}
				
				// Top tags
				if (tagStats.size > 0) {
					console.log('\n🏷️  Top Tags:');
					const topTags = Array.from(tagStats.entries())
						.sort((a, b) => b[1] - a[1])
						.slice(0, 5);
					topTags.forEach(([tag, count]) => {
						console.log(`  ${tag}: ${count} files`);
					});
				}
				
				// File formats
				if (formatStats.size > 0) {
					console.log('\n📄 File Formats:');
					const sortedFormats = Array.from(formatStats.entries())
						.sort((a, b) => b[1] - a[1]);
					sortedFormats.forEach(([format, count]) => {
						const formatName = format || 'no extension';
						console.log(`  ${formatName}: ${count} files`);
					});
				}
			}
		} catch (error) {
			console.error(`Error: ${error.message}`);
		}
		process.exit(0);
	} else if (interactiveCommands.includes(command)) {
		console.error('Error: Interactive mode not available in this environment.');
		process.exit(1);
	}
} else {
	// Interactive mode for add and ls commands only
	if (interactiveCommands.includes(command)) {
		render(<App {...appProps} />);
	} else {
		console.error('Error: This command should run in non-interactive mode.');
		process.exit(1);
	}
}
