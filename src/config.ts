import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, type RouterConfig } from './types.js';

/**
 * Get configuration from environment variables with defaults
 */
export function getConfig(): RouterConfig {
  return {
    maxResults: parseInt(process.env.SKILL_ROUTER_MAX_RESULTS ?? '', 10) || DEFAULT_CONFIG.maxResults,
    threshold: parseFloat(process.env.SKILL_ROUTER_THRESHOLD ?? '') || DEFAULT_CONFIG.threshold,
    bm25K1: parseFloat(process.env.SKILL_ROUTER_BM25_K1 ?? '') || DEFAULT_CONFIG.bm25K1,
    bm25B: parseFloat(process.env.SKILL_ROUTER_BM25_B ?? '') || DEFAULT_CONFIG.bm25B,
    alwaysInclude: process.env.SKILL_ROUTER_ALWAYS_INCLUDE
      ? process.env.SKILL_ROUTER_ALWAYS_INCLUDE.split(',').map((s) => s.trim())
      : DEFAULT_CONFIG.alwaysInclude,
    contextFilePath: process.env.SKILL_ROUTER_CONTEXT_PATH ?? DEFAULT_CONFIG.contextFilePath,
    indexPath: process.env.SKILL_ROUTER_INDEX_PATH ?? DEFAULT_CONFIG.indexPath,
  };
}

/**
 * Standard OpenClaw skill directory paths in priority order
 */
export function getSkillDirectories(): string[] {
  const home = homedir();
  return [
    join(home, '.openclaw', 'workspace', 'skills'),
    join(home, '.openclaw', 'managed-skills'),
    // Bundled skills would be relative to node_modules, but we skip those for now
  ];
}

/**
 * Get the default index file path
 */
export function getDefaultIndexPath(): string {
  return join(homedir(), '.openclaw', '.skill-router-index.json');
}

/**
 * Get the default context file path (in current working directory)
 */
export function getDefaultContextPath(): string {
  return join(process.cwd(), '.skill-router-context.md');
}
