#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
		Usage
		  $ menma add <title> <project>
		  $ menma ls [options]

		Options
			--help       Show this help
			--project    Filter by project name
			--tag        Filter by tag
			--search     Search in file content

		Examples
		  $ menma add "Meeting Notes" "ProjectX"
		  $ menma ls
		  $ menma ls --project "ProjectX"
		  $ menma ls --tag "urgent"
		  $ menma ls --search "keyword"
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
			}
		}
	},
);

const command = cli.input[0];

if (!command || !['add', 'ls'].includes(command)) {
	console.log('Error: Please specify either "add" or "ls" command');
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
}

// For testing purposes, bypass TTY check temporarily
if (process.env.NODE_ENV === 'test' || !process.stdin.isTTY) {
	// Non-interactive mode for testing
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
				console.log('Title'.padEnd(32) + ' | ' + 'Project'.padEnd(17) + ' | ' + 'Tags'.padEnd(22) + ' | ' + 'Created');
				console.log('-'.repeat(32) + ' | ' + '-'.repeat(17) + ' | ' + '-'.repeat(22) + ' | ' + '-'.repeat(16));
				
				files.forEach(file => {
					const title = (file.title || 'Untitled').substring(0, 30).padEnd(32);
					const project = (file.project || 'No Project').substring(0, 15).padEnd(17);
					const tags = file.tags.length > 0 ? `[${file.tags.slice(0, 2).join(', ')}]` : '[no tags]';
					const tagsDisplay = tags.substring(0, 20).padEnd(22);
					const date = file.createdAt.toLocaleDateString('ja-JP', {
						year: 'numeric',
						month: '2-digit',
						day: '2-digit',
						hour: '2-digit',
						minute: '2-digit'
					});
					
					console.log(`${title} | ${project} | ${tagsDisplay} | ${date}`);
				});
			}
		} catch (error) {
			console.error(`Error: ${error.message}`);
		}
		process.exit(0);
	} else {
		console.error('Error: Interactive mode not available. Only "ls" command supported in non-TTY mode.');
		process.exit(1);
	}
} else {
	render(<App {...appProps} />);
}
