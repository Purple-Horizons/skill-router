import { tokenizeQuery } from './keywords.js';
import type { SkillEntry, SkillIndex, ScoringResult, RouterConfig } from '../types.js';

/**
 * BM25 scoring implementation
 *
 * BM25 formula:
 * score(D,Q) = Σ IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D|/avgdl))
 *
 * Where:
 * - f(qi,D) = frequency of term qi in document D
 * - |D| = document length
 * - avgdl = average document length
 * - k1 = term frequency saturation parameter (typically 1.2)
 * - b = document length normalization parameter (typically 0.75)
 */
export class BM25Scorer {
  private readonly k1: number;
  private readonly b: number;
  private readonly index: SkillIndex;

  constructor(index: SkillIndex, k1 = 1.2, b = 0.75) {
    this.index = index;
    this.k1 = k1;
    this.b = b;
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term
   * IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
   */
  private calculateIDF(term: string): number {
    const N = this.index.skills.length;
    const n = this.index.documentFrequency[term] ?? 0;

    // Avoid division by zero and handle edge cases
    if (n === 0) return 0;

    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }

  /**
   * Get term frequency in a skill document
   */
  private getTermFrequency(skill: SkillEntry, term: string): number {
    let count = 0;

    // Check keywords (weighted more heavily)
    for (const keyword of skill.keywords) {
      if (keyword === term || keyword.includes(term)) {
        count += 2; // Keywords are worth more
      }
    }

    // Check tokens
    for (const token of skill.tokens) {
      if (token === term) {
        count += 1;
      }
    }

    return count;
  }

  /**
   * Get document length (number of terms)
   */
  private getDocLength(skill: SkillEntry): number {
    return skill.keywords.length + skill.tokens.length;
  }

  /**
   * Score a single skill against query terms
   */
  scoreSkill(skill: SkillEntry, queryTerms: string[]): ScoringResult {
    const docLength = this.getDocLength(skill);
    const avgDocLength = this.index.avgDocLength;
    const matchedKeywords: string[] = [];

    let score = 0;

    for (const term of queryTerms) {
      const tf = this.getTermFrequency(skill, term);

      if (tf > 0) {
        matchedKeywords.push(term);

        const idf = this.calculateIDF(term);
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / avgDocLength));

        score += idf * (numerator / denominator);
      }
    }

    return {
      skill,
      score,
      matchedKeywords: [...new Set(matchedKeywords)],
    };
  }

  /**
   * Score all skills against a query and return sorted results
   */
  scoreAll(query: string): ScoringResult[] {
    const queryTerms = tokenizeQuery(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const results: ScoringResult[] = [];

    for (const skill of this.index.skills) {
      const result = this.scoreSkill(skill, queryTerms);
      results.push(result);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results;
  }
}

/**
 * Score a query against the index and return top matching skills
 */
export function scoreQuery(
  index: SkillIndex,
  query: string,
  config: Pick<RouterConfig, 'maxResults' | 'threshold' | 'bm25K1' | 'bm25B' | 'alwaysInclude'>
): ScoringResult[] {
  const scorer = new BM25Scorer(index, config.bm25K1, config.bm25B);
  const allResults = scorer.scoreAll(query);

  // Get always-include skills first
  const alwaysIncludeSkills = index.skills.filter(
    (s) => s.alwaysInclude || config.alwaysInclude.includes(s.name)
  );

  const alwaysIncludeNames = new Set(alwaysIncludeSkills.map((s) => s.name));

  // Filter by threshold and exclude always-include skills
  const filteredResults = allResults.filter(
    (r) => r.score >= config.threshold && !alwaysIncludeNames.has(r.skill.name)
  );

  // Take top N results
  const topResults = filteredResults.slice(0, config.maxResults);

  // Add always-include skills with score 0 if not already in results
  const alwaysIncludeResults: ScoringResult[] = alwaysIncludeSkills.map((skill) => {
    const existing = allResults.find((r) => r.skill.name === skill.name);
    return (
      existing ?? {
        skill,
        score: 0,
        matchedKeywords: [],
      }
    );
  });

  // Combine: always-include first, then scored results
  return [...alwaysIncludeResults, ...topResults];
}
