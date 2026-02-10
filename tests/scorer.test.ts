import { describe, it, expect } from 'vitest';
import { BM25Scorer, scoreQuery } from '../src/core/scorer.js';
import type { SkillIndex, SkillEntry } from '../src/types.js';

function createMockIndex(skills: Partial<SkillEntry>[]): SkillIndex {
  const fullSkills: SkillEntry[] = skills.map((s, i) => ({
    name: s.name ?? `skill-${i}`,
    description: s.description ?? 'A test skill',
    location: s.location ?? `/path/to/skill-${i}`,
    keywords: s.keywords ?? [],
    tokens: s.tokens ?? [],
    tools: s.tools,
    alwaysInclude: s.alwaysInclude,
  }));

  // Calculate document frequency
  const documentFrequency: Record<string, number> = {};
  for (const skill of fullSkills) {
    const allTerms = new Set([...skill.keywords, ...skill.tokens]);
    for (const term of allTerms) {
      documentFrequency[term] = (documentFrequency[term] ?? 0) + 1;
    }
  }

  // Calculate average document length
  const totalLength = fullSkills.reduce(
    (sum, skill) => sum + skill.keywords.length + skill.tokens.length,
    0
  );
  const avgDocLength = fullSkills.length > 0 ? totalLength / fullSkills.length : 0;

  return {
    version: 1,
    generated: new Date().toISOString(),
    skills: fullSkills,
    documentFrequency,
    avgDocLength,
  };
}

describe('BM25Scorer', () => {
  it('scores skills based on keyword matches', () => {
    const index = createMockIndex([
      { name: 'github-pr', keywords: ['github', 'pr', 'pull', 'request'] },
      { name: 'git-commit', keywords: ['git', 'commit', 'message'] },
      { name: 'unrelated', keywords: ['database', 'sql'] },
    ]);

    const scorer = new BM25Scorer(index);
    const results = scorer.scoreAll('create github pr');

    // github-pr should score highest
    expect(results[0].skill.name).toBe('github-pr');
    expect(results[0].score).toBeGreaterThan(0);

    // unrelated should score zero
    const unrelatedResult = results.find((r) => r.skill.name === 'unrelated');
    expect(unrelatedResult?.score).toBe(0);
  });

  it('returns matched keywords', () => {
    const index = createMockIndex([
      { name: 'github-pr', keywords: ['github', 'pr', 'pull', 'request'] },
    ]);

    const scorer = new BM25Scorer(index);
    const results = scorer.scoreAll('github pr');

    expect(results[0].matchedKeywords).toContain('github');
    expect(results[0].matchedKeywords).toContain('pr');
  });

  it('handles empty query', () => {
    const index = createMockIndex([{ name: 'test', keywords: ['test'] }]);

    const scorer = new BM25Scorer(index);
    const results = scorer.scoreAll('');

    expect(results).toEqual([]);
  });

  it('handles query with only stopwords', () => {
    const index = createMockIndex([{ name: 'test', keywords: ['test'] }]);

    const scorer = new BM25Scorer(index);
    const results = scorer.scoreAll('the and is');

    expect(results).toEqual([]);
  });

  it('weighs keywords higher than tokens', () => {
    const index = createMockIndex([
      { name: 'keyword-match', keywords: ['github'], tokens: [] },
      { name: 'token-match', keywords: [], tokens: ['github'] },
    ]);

    const scorer = new BM25Scorer(index);
    const results = scorer.scoreAll('github');

    const keywordResult = results.find((r) => r.skill.name === 'keyword-match');
    const tokenResult = results.find((r) => r.skill.name === 'token-match');

    expect(keywordResult!.score).toBeGreaterThan(tokenResult!.score);
  });
});

describe('scoreQuery', () => {
  it('filters results by threshold', () => {
    const index = createMockIndex([
      { name: 'high-match', keywords: ['github', 'pr', 'code'] },
      { name: 'low-match', keywords: ['github'] },
      { name: 'no-match', keywords: ['database'] },
    ]);

    const results = scoreQuery(index, 'github pr code', {
      maxResults: 10,
      threshold: 1.0, // High threshold
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    // Should only include skills above threshold
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(1.0);
    }
  });

  it('limits results by maxResults', () => {
    const index = createMockIndex([
      { name: 'skill-1', keywords: ['test', 'match'] },
      { name: 'skill-2', keywords: ['test', 'match'] },
      { name: 'skill-3', keywords: ['test', 'match'] },
      { name: 'skill-4', keywords: ['test', 'match'] },
    ]);

    const results = scoreQuery(index, 'test match', {
      maxResults: 2,
      threshold: 0,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('includes always-include skills from config', () => {
    const index = createMockIndex([
      { name: 'router', keywords: ['routing'] },
      { name: 'other', keywords: ['something'] },
    ]);

    const results = scoreQuery(index, 'unrelated query xyz', {
      maxResults: 3,
      threshold: 0.5,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: ['router'],
    });

    const routerResult = results.find((r) => r.skill.name === 'router');
    expect(routerResult).toBeDefined();
  });

  it('includes skills with alwaysInclude metadata', () => {
    const index = createMockIndex([
      { name: 'always-skill', keywords: ['test'], alwaysInclude: true },
      { name: 'normal-skill', keywords: ['other'] },
    ]);

    const results = scoreQuery(index, 'unrelated query', {
      maxResults: 3,
      threshold: 0.5,
      bm25K1: 1.2,
      bm25B: 0.75,
      alwaysInclude: [],
    });

    const alwaysResult = results.find((r) => r.skill.name === 'always-skill');
    expect(alwaysResult).toBeDefined();
  });
});
