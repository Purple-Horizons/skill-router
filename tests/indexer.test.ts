import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseSkillFile, scanSkillDirectory, buildIndex, saveIndex, loadIndex } from '../src/core/indexer.js';

describe('parseSkillFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('parses valid SKILL.md with frontmatter', () => {
    const skillPath = join(tempDir, 'SKILL.md');
    writeFileSync(
      skillPath,
      `---
name: test-skill
description: A test skill for testing
tools: Bash, Read
---

# Test Skill

This skill does testing things.

## Keywords

test, testing, unit
`
    );

    const result = parseSkillFile(skillPath);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe('test-skill');
    expect(result!.frontmatter.description).toBe('A test skill for testing');
    expect(result!.frontmatter.tools).toBe('Bash, Read');
    expect(result!.content).toContain('# Test Skill');
  });

  it('returns null for missing required fields', () => {
    const skillPath = join(tempDir, 'SKILL.md');
    writeFileSync(
      skillPath,
      `---
name: test-skill
---

No description field.
`
    );

    const result = parseSkillFile(skillPath);
    expect(result).toBeNull();
  });

  it('returns null for non-existent file', () => {
    const result = parseSkillFile(join(tempDir, 'nonexistent.md'));
    expect(result).toBeNull();
  });

  it('parses metadata with always flag', () => {
    const skillPath = join(tempDir, 'SKILL.md');
    writeFileSync(
      skillPath,
      `---
name: always-skill
description: Always included
metadata:
  openclaw:
    always: true
---

Content.
`
    );

    const result = parseSkillFile(skillPath);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.metadata?.openclaw?.always).toBe(true);
  });
});

describe('scanSkillDirectory', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds skills in subdirectories', () => {
    // Create skill-1
    const skill1Dir = join(tempDir, 'skill-1');
    mkdirSync(skill1Dir);
    writeFileSync(
      join(skill1Dir, 'SKILL.md'),
      `---
name: skill-1
description: First skill
---

Content 1.
`
    );

    // Create skill-2
    const skill2Dir = join(tempDir, 'skill-2');
    mkdirSync(skill2Dir);
    writeFileSync(
      join(skill2Dir, 'SKILL.md'),
      `---
name: skill-2
description: Second skill
---

Content 2.
`
    );

    const results = scanSkillDirectory(tempDir);
    expect(results).toHaveLength(2);
    expect(results.map((s) => s.name)).toContain('skill-1');
    expect(results.map((s) => s.name)).toContain('skill-2');
  });

  it('ignores directories without SKILL.md', () => {
    const noSkillDir = join(tempDir, 'not-a-skill');
    mkdirSync(noSkillDir);
    writeFileSync(join(noSkillDir, 'README.md'), '# Not a skill');

    const results = scanSkillDirectory(tempDir);
    expect(results).toHaveLength(0);
  });

  it('returns empty array for non-existent directory', () => {
    const results = scanSkillDirectory('/nonexistent/path');
    expect(results).toEqual([]);
  });

  it('extracts keywords and tokens', () => {
    const skillDir = join(tempDir, 'keyword-skill');
    mkdirSync(skillDir);
    writeFileSync(
      join(skillDir, 'SKILL.md'),
      `---
name: keyword-skill
description: GitHub PR creation
---

Creates pull requests.

## Keywords

github, pr, merge
`
    );

    const results = scanSkillDirectory(tempDir);
    expect(results).toHaveLength(1);
    expect(results[0].keywords).toContain('github');
    expect(results[0].keywords).toContain('pr');
    expect(results[0].tokens.length).toBeGreaterThan(0);
  });
});

describe('buildIndex', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('builds index with document frequency', () => {
    // Create two skills sharing a term
    const skill1Dir = join(tempDir, 'skill-1');
    mkdirSync(skill1Dir);
    writeFileSync(
      join(skill1Dir, 'SKILL.md'),
      `---
name: skill-1
description: shared unique1
---

Content with shared term.
`
    );

    const skill2Dir = join(tempDir, 'skill-2');
    mkdirSync(skill2Dir);
    writeFileSync(
      join(skill2Dir, 'SKILL.md'),
      `---
name: skill-2
description: shared unique2
---

Content with shared term.
`
    );

    const index = buildIndex([tempDir]);
    expect(index.skills).toHaveLength(2);
    expect(index.documentFrequency['shared']).toBe(2);
    expect(index.documentFrequency['unique1']).toBe(1);
    expect(index.documentFrequency['unique2']).toBe(1);
    expect(index.avgDocLength).toBeGreaterThan(0);
  });
});

describe('saveIndex and loadIndex', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and loads index correctly', () => {
    const indexPath = join(tempDir, 'index.json');
    const index = {
      version: 1,
      generated: new Date().toISOString(),
      skills: [
        {
          name: 'test',
          description: 'Test skill',
          location: '/path/to/test',
          keywords: ['test'],
          tokens: ['content'],
        },
      ],
      documentFrequency: { test: 1, content: 1 },
      avgDocLength: 2,
    };

    saveIndex(index, indexPath);
    const loaded = loadIndex(indexPath);

    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.skills).toHaveLength(1);
    expect(loaded!.skills[0].name).toBe('test');
  });

  it('returns null for non-existent index', () => {
    const result = loadIndex(join(tempDir, 'nonexistent.json'));
    expect(result).toBeNull();
  });
});
