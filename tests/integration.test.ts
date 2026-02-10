import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildIndex, saveIndex, loadIndex } from '../src/core/indexer.js';
import { scoreQuery } from '../src/core/scorer.js';
import { writeContextFile, readContextFile } from '../src/core/injector.js';

describe('Integration: Full routing flow', () => {
  let tempDir: string;
  let skillsDir: string;
  let indexPath: string;
  let contextPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-integration-'));
    skillsDir = join(tempDir, 'skills');
    indexPath = join(tempDir, 'index.json');
    contextPath = join(tempDir, '.skillrouter-context.md');

    mkdirSync(skillsDir);

    // Create github-pr skill
    const githubPrDir = join(skillsDir, 'github-pr');
    mkdirSync(githubPrDir);
    writeFileSync(
      join(githubPrDir, 'SKILL.md'),
      `---
name: github-pr
description: Creates and manages GitHub pull requests
tools: Bash
---

# GitHub PR Skill

Use this skill to create, review, and manage pull requests.

## Keywords

github, pr, pull request, merge, code review
`
    );

    // Create git-commit skill
    const gitCommitDir = join(skillsDir, 'git-commit');
    mkdirSync(gitCommitDir);
    writeFileSync(
      join(gitCommitDir, 'SKILL.md'),
      `---
name: git-commit
description: Creates well-formatted git commits
tools: Bash
---

# Git Commit Skill

Use this skill to create commits with proper messages.

## Keywords

git, commit, message, staging
`
    );

    // Create database skill (unrelated)
    const dbDir = join(skillsDir, 'database');
    mkdirSync(dbDir);
    writeFileSync(
      join(dbDir, 'SKILL.md'),
      `---
name: database
description: Database operations and queries
tools: Bash
---

# Database Skill

SQL and database management.

## Keywords

sql, database, query, postgres
`
    );

    // Create always-include skill
    const routerDir = join(skillsDir, 'skill-router');
    mkdirSync(routerDir);
    writeFileSync(
      join(routerDir, 'SKILL.md'),
      `---
name: skill-router
description: Routes messages to appropriate skills
tools: Bash
metadata:
  openclaw:
    always: true
---

# Skill Router

Always included.
`
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('indexes skills and scores GitHub-related query', () => {
    // Build index
    const index = buildIndex([skillsDir]);
    expect(index.skills).toHaveLength(4);
    saveIndex(index, indexPath);

    // Load and verify
    const loadedIndex = loadIndex(indexPath);
    expect(loadedIndex).not.toBeNull();

    // Score a GitHub-related query
    const results = scoreQuery(loadedIndex!, 'create a github pull request', {
      maxResults: 3,
      threshold: 0.1,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    // Should match github-pr skill with high score
    const githubResult = results.find((r) => r.skill.name === 'github-pr');
    expect(githubResult).toBeDefined();
    expect(githubResult!.score).toBeGreaterThan(0);
    expect(githubResult!.matchedKeywords).toContain('github');

    // Database skill should not match or have very low score
    const dbResult = results.find((r) => r.skill.name === 'database');
    expect(dbResult?.score ?? 0).toBe(0);
  });

  it('indexes skills and scores commit-related query', () => {
    const index = buildIndex([skillsDir]);
    saveIndex(index, indexPath);
    const loadedIndex = loadIndex(indexPath);

    const results = scoreQuery(loadedIndex!, 'make a git commit', {
      maxResults: 3,
      threshold: 0.1,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    const commitResult = results.find((r) => r.skill.name === 'git-commit');
    expect(commitResult).toBeDefined();
    expect(commitResult!.score).toBeGreaterThan(0);
  });

  it('includes always-include skills', () => {
    const index = buildIndex([skillsDir]);
    saveIndex(index, indexPath);
    const loadedIndex = loadIndex(indexPath);

    const results = scoreQuery(loadedIndex!, 'random unrelated query xyz', {
      maxResults: 3,
      threshold: 0.5,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    // skill-router should be included due to metadata.openclaw.always
    const routerResult = results.find((r) => r.skill.name === 'skill-router');
    expect(routerResult).toBeDefined();
  });

  it('writes context file with matched skills', () => {
    const index = buildIndex([skillsDir]);
    saveIndex(index, indexPath);
    const loadedIndex = loadIndex(indexPath);

    const results = scoreQuery(loadedIndex!, 'create github pr', {
      maxResults: 3,
      threshold: 0.1,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    writeContextFile(results, contextPath);

    expect(existsSync(contextPath)).toBe(true);

    const content = readContextFile(contextPath);
    expect(content).toContain('github-pr');
    expect(content).toContain('<available_skills>');
    expect(content).toContain('SKILL.md');
  });

  it('handles empty query gracefully', () => {
    const index = buildIndex([skillsDir]);
    const loadedIndex = index;

    const results = scoreQuery(loadedIndex, '', {
      maxResults: 3,
      threshold: 0.1,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    // Only always-include skills should be present
    const nonAlwaysResults = results.filter((r) => !r.skill.alwaysInclude);
    expect(nonAlwaysResults.every((r) => r.score === 0)).toBe(true);
  });

  it('respects maxResults limit', () => {
    const index = buildIndex([skillsDir]);

    // Query that matches multiple skills
    const results = scoreQuery(index, 'git github code', {
      maxResults: 1,
      threshold: 0.0,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    // Should have at most 1 result (plus always-include)
    const scoredResults = results.filter((r) => r.score > 0);
    expect(scoredResults.length).toBeLessThanOrEqual(1);
  });
});
