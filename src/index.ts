#!/usr/bin/env node

import { Command } from 'commander';
import { buildCommand } from './commands/build.js';
import { matchCommand } from './commands/match.js';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('skill-router')
  .description('Dynamic skill routing for OpenClaw - load only relevant skills per message')
  .version('0.1.0');

program
  .command('build')
  .description('Build the skill index by scanning skill directories')
  .option('-f, --force', 'Force rebuild even if index exists')
  .option('-o, --output <path>', 'Output path for the index file')
  .option('-p, --paths <paths...>', 'Additional skill directory paths to scan')
  .action((options) => {
    buildCommand({
      force: options.force,
      output: options.output,
      paths: options.paths,
    });
  });

program
  .command('match <message>')
  .description('Match a message against the skill index')
  .option('-i, --index <path>', 'Path to the index file')
  .option('-o, --output <path>', 'Output path for the context file')
  .option('-n, --max-results <n>', 'Maximum number of skills to return', parseInt)
  .option('-t, --threshold <n>', 'Minimum score threshold', parseFloat)
  .option('--json', 'Output results as JSON')
  .action((message, options) => {
    matchCommand(message, {
      index: options.index,
      output: options.output,
      maxResults: options.maxResults,
      threshold: options.threshold,
      json: options.json,
    });
  });

program
  .command('status')
  .description('Show index status and configuration')
  .option('-i, --index <path>', 'Path to the index file')
  .option('--json', 'Output as JSON')
  .action((options) => {
    statusCommand({
      index: options.index,
      json: options.json,
    });
  });

program.parse();
