/**
 * Represents a skill entry in the index
 */
export interface SkillEntry {
  /** Skill name from frontmatter */
  name: string;
  /** Skill description from frontmatter */
  description: string;
  /** Absolute path to the skill directory */
  location: string;
  /** Extracted keywords for BM25 matching */
  keywords: string[];
  /** Raw content tokens from SKILL.md body */
  tokens: string[];
  /** Tools the skill uses (from frontmatter) */
  tools?: string[];
  /** Whether this skill should always be included */
  alwaysInclude?: boolean;
}

/**
 * The skill index file structure
 */
export interface SkillIndex {
  /** Index format version */
  version: number;
  /** ISO timestamp when index was generated */
  generated: string;
  /** All indexed skills */
  skills: SkillEntry[];
  /** Document frequency for each term (for BM25 IDF calculation) */
  documentFrequency: Record<string, number>;
  /** Average document length for BM25 */
  avgDocLength: number;
}

/**
 * Result of scoring a skill against a query
 */
export interface ScoringResult {
  /** The matched skill */
  skill: SkillEntry;
  /** BM25 score */
  score: number;
  /** Keywords that matched the query */
  matchedKeywords: string[];
}

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Maximum number of skills to return */
  maxResults: number;
  /** Minimum score threshold to include a skill */
  threshold: number;
  /** BM25 k1 parameter (term frequency saturation) */
  bm25K1: number;
  /** BM25 b parameter (document length normalization) */
  bm25B: number;
  /** Skills to always include regardless of score */
  alwaysInclude: string[];
  /** Path to write context file */
  contextFilePath: string;
  /** Path to store the index */
  indexPath: string;
}

/**
 * SKILL.md frontmatter structure
 */
export interface SkillFrontmatter {
  name: string;
  description: string;
  tools?: string;
  metadata?: {
    openclaw?: {
      always?: boolean;
    };
  };
}

/**
 * Parsed SKILL.md content
 */
export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  content: string;
  keywordsSection?: string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: RouterConfig = {
  maxResults: 3,
  threshold: 0.3,
  bm25K1: 1.2,
  bm25B: 0.75,
  alwaysInclude: ['skill-router'],
  contextFilePath: '.skill-router-context.md',
  indexPath: '.skill-router-index.json',
};
