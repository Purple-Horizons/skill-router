import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  formatSkillsAsXml,
  generateContextContent,
  writeContextFile,
  readContextFile,
  cleanupContextFile,
} from '../src/core/injector.js';
import type { ScoringResult, SkillEntry } from '../src/types.js';

function createMockResult(overrides: Partial<ScoringResult> = {}): ScoringResult {
  const skill: SkillEntry = {
    name: overrides.skill?.name ?? 'test-skill',
    description: overrides.skill?.description ?? 'A test skill',
    location: overrides.skill?.location ?? '/path/to/test-skill',
    keywords: overrides.skill?.keywords ?? ['test'],
    tokens: overrides.skill?.tokens ?? [],
  };

  return {
    skill,
    score: overrides.score ?? 1.5,
    matchedKeywords: overrides.matchedKeywords ?? ['test'],
  };
}

describe('formatSkillsAsXml', () => {
  it('formats skills as XML', () => {
    const results: ScoringResult[] = [
      createMockResult({
        skill: { name: 'github-pr', description: 'Creates pull requests', location: '/skills/github-pr', keywords: [], tokens: [] },
        score: 2.5,
        matchedKeywords: ['github', 'pr'],
      }),
    ];

    const xml = formatSkillsAsXml(results);

    expect(xml).toContain('<available_skills>');
    expect(xml).toContain('</available_skills>');
    expect(xml).toContain('name="github-pr"');
    expect(xml).toContain('score="2.50"');
    expect(xml).toContain('matched="github, pr"');
    expect(xml).toContain('<description>Creates pull requests</description>');
    expect(xml).toContain('<location>/skills/github-pr</location>');
  });

  it('handles empty results', () => {
    const xml = formatSkillsAsXml([]);
    expect(xml).toContain('No skills matched');
  });

  it('handles skills with zero score (always-include)', () => {
    const results: ScoringResult[] = [
      createMockResult({
        score: 0,
        matchedKeywords: [],
      }),
    ];

    const xml = formatSkillsAsXml(results);
    expect(xml).not.toContain('score=');
    expect(xml).not.toContain('matched=');
  });
});

describe('generateContextContent', () => {
  it('includes skill paths in next steps', () => {
    const results: ScoringResult[] = [
      createMockResult({
        skill: { name: 'skill-1', description: 'First', location: '/path/to/skill-1', keywords: [], tokens: [] },
      }),
      createMockResult({
        skill: { name: 'skill-2', description: 'Second', location: '/path/to/skill-2', keywords: [], tokens: [] },
      }),
    ];

    const content = generateContextContent(results);

    expect(content).toContain('/path/to/skill-1/SKILL.md');
    expect(content).toContain('/path/to/skill-2/SKILL.md');
    expect(content).toContain('Read the SKILL.md file');
  });

  it('shows no-match message when empty', () => {
    const content = generateContextContent([]);
    expect(content).toContain('No skills matched');
    expect(content).toContain('general assistance');
  });

  it('includes timestamp and matched skill names', () => {
    const results: ScoringResult[] = [
      createMockResult({ skill: { name: 'test-skill', description: 'Test', location: '/test', keywords: [], tokens: [] } }),
    ];

    const content = generateContextContent(results);

    expect(content).toContain('Generated:');
    expect(content).toContain('Matched: test-skill');
  });
});

describe('writeContextFile and readContextFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('writes and reads context file', () => {
    const filePath = join(tempDir, '.skillrouter-context.md');
    const results: ScoringResult[] = [createMockResult()];

    writeContextFile(results, filePath);

    expect(existsSync(filePath)).toBe(true);

    const content = readContextFile(filePath);
    expect(content).not.toBeNull();
    expect(content).toContain('SkillRouter Context');
  });

  it('readContextFile returns null for non-existent file', () => {
    const result = readContextFile(join(tempDir, 'nonexistent.md'));
    expect(result).toBeNull();
  });
});

describe('cleanupContextFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'skillrouter-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('removes existing context file', () => {
    const filePath = join(tempDir, '.skillrouter-context.md');
    writeContextFile([createMockResult()], filePath);

    expect(existsSync(filePath)).toBe(true);

    const result = cleanupContextFile(filePath);

    expect(result).toBe(true);
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns false for non-existent file', () => {
    const result = cleanupContextFile(join(tempDir, 'nonexistent.md'));
    expect(result).toBe(false);
  });
});
