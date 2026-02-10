import { describe, it, expect } from 'vitest';
import {
  tokenize,
  extractUniqueTokens,
  extractKeywordsSection,
  extractKeywords,
  tokenizeQuery,
} from '../src/core/keywords.js';

describe('tokenize', () => {
  it('converts text to lowercase tokens', () => {
    const result = tokenize('Hello World');
    expect(result).toContain('hello');
    expect(result).toContain('world');
  });

  it('removes punctuation', () => {
    const result = tokenize('Hello, World! How are you?');
    expect(result).not.toContain(',');
    expect(result).not.toContain('!');
    expect(result).not.toContain('?');
  });

  it('removes stopwords', () => {
    const result = tokenize('the quick brown fox and the lazy dog');
    expect(result).not.toContain('the');
    expect(result).not.toContain('and');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('fox');
    expect(result).toContain('lazy');
    expect(result).toContain('dog');
  });

  it('filters short tokens and stopwords', () => {
    // 'a' and 'I' are too short (< 2 chars)
    // 'is' and 'to' are stopwords
    // 'am' and 'go' are valid 2-char tokens but not stopwords
    const result = tokenize('a I is to');
    expect(result).toHaveLength(0);
  });

  it('handles hyphens', () => {
    const result = tokenize('skill-router is a tool');
    expect(result).toContain('skill-router');
  });

  it('handles empty input', () => {
    const result = tokenize('');
    expect(result).toEqual([]);
  });
});

describe('extractUniqueTokens', () => {
  it('returns unique tokens only', () => {
    const result = extractUniqueTokens('hello hello world world hello');
    expect(result).toEqual(['hello', 'world']);
  });

  it('preserves order of first occurrence', () => {
    const result = extractUniqueTokens('world hello world');
    expect(result[0]).toBe('world');
    expect(result[1]).toBe('hello');
  });
});

describe('extractKeywordsSection', () => {
  it('extracts comma-separated keywords', () => {
    const content = `# Some Content

## Keywords

github, pull request, code review

## Other Section
`;
    const result = extractKeywordsSection(content);
    expect(result).toContain('github');
    expect(result).toContain('pull request');
    expect(result).toContain('code review');
  });

  it('extracts list-format keywords', () => {
    const content = `## Keywords

- github
- pull request
- code review
`;
    const result = extractKeywordsSection(content);
    expect(result).toContain('github');
    expect(result).toContain('pull request');
    expect(result).toContain('code review');
  });

  it('handles asterisk lists', () => {
    const content = `## Keywords

* github
* pr
`;
    const result = extractKeywordsSection(content);
    expect(result).toContain('github');
    expect(result).toContain('pr');
  });

  it('returns empty array when no keywords section', () => {
    const content = `# Just a title

Some content without keywords.
`;
    const result = extractKeywordsSection(content);
    expect(result).toEqual([]);
  });

  it('is case-insensitive for section header', () => {
    const content = `## KEYWORDS

github, pr
`;
    const result = extractKeywordsSection(content);
    expect(result).toContain('github');
  });
});

describe('extractKeywords', () => {
  it('combines explicit keywords with description tokens', () => {
    const description = 'Creates GitHub pull requests';
    const content = `## Keywords

pr, merge
`;
    const result = extractKeywords(description, content);
    expect(result).toContain('github');
    expect(result).toContain('pull');
    expect(result).toContain('requests');
    expect(result).toContain('pr');
    expect(result).toContain('merge');
  });

  it('deduplicates keywords', () => {
    const description = 'GitHub integration';
    const content = `## Keywords

github, integration
`;
    const result = extractKeywords(description, content);
    const githubCount = result.filter((k) => k === 'github').length;
    expect(githubCount).toBe(1);
  });
});

describe('tokenizeQuery', () => {
  it('tokenizes a user query', () => {
    const result = tokenizeQuery('create a github pr');
    expect(result).toContain('create');
    expect(result).toContain('github');
    expect(result).toContain('pr');
  });

  it('removes stopwords from queries', () => {
    const result = tokenizeQuery('how do I create a pull request');
    expect(result).not.toContain('how');
    expect(result).not.toContain('do');
    expect(result).toContain('create');
    expect(result).toContain('pull');
    expect(result).toContain('request');
  });
});
