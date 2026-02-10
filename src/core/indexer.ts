import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { getSkillDirectories } from '../config.js';
import { extractKeywords, extractUniqueTokens } from './keywords.js';
import type { SkillEntry, SkillIndex, SkillFrontmatter, ParsedSkill } from '../types.js';

/**
 * Parse a SKILL.md file and extract frontmatter and content
 */
export function parseSkillFile(filePath: string): ParsedSkill | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const frontmatter = data as SkillFrontmatter;

    // Validate required fields
    if (!frontmatter.name || !frontmatter.description) {
      return null;
    }

    return {
      frontmatter,
      content,
    };
  } catch {
    return null;
  }
}

/**
 * Scan a directory for skill subdirectories containing SKILL.md
 */
export function scanSkillDirectory(basePath: string): SkillEntry[] {
  const skills: SkillEntry[] = [];

  if (!existsSync(basePath)) {
    return skills;
  }

  try {
    const entries = readdirSync(basePath);

    for (const entry of entries) {
      const skillDir = join(basePath, entry);
      const skillFile = join(skillDir, 'SKILL.md');

      // Check if it's a directory with SKILL.md
      if (statSync(skillDir).isDirectory() && existsSync(skillFile)) {
        const parsed = parseSkillFile(skillFile);
        if (parsed) {
          const keywords = extractKeywords(parsed.frontmatter.description, parsed.content);
          const tokens = extractUniqueTokens(parsed.content);

          skills.push({
            name: parsed.frontmatter.name,
            description: parsed.frontmatter.description,
            location: skillDir,
            keywords,
            tokens,
            tools: parsed.frontmatter.tools?.split(',').map((t) => t.trim()),
            alwaysInclude: parsed.frontmatter.metadata?.openclaw?.always ?? false,
          });
        }
      }
    }
  } catch {
    // Directory read failed, return empty
  }

  return skills;
}

/**
 * Scan all skill directories and collect skills
 */
export function scanAllSkillDirectories(additionalPaths: string[] = []): SkillEntry[] {
  const directories = [...getSkillDirectories(), ...additionalPaths];
  const skills: SkillEntry[] = [];
  const seenNames = new Set<string>();

  // Scan in priority order - first occurrence wins
  for (const dir of directories) {
    const dirSkills = scanSkillDirectory(dir);
    for (const skill of dirSkills) {
      if (!seenNames.has(skill.name)) {
        seenNames.add(skill.name);
        skills.push(skill);
      }
    }
  }

  return skills;
}

/**
 * Calculate document frequency for each term across all skills
 */
function calculateDocumentFrequency(skills: SkillEntry[]): Record<string, number> {
  const df: Record<string, number> = {};

  for (const skill of skills) {
    // Combine keywords and tokens, get unique terms
    const allTerms = new Set([...skill.keywords, ...skill.tokens]);

    for (const term of allTerms) {
      df[term] = (df[term] ?? 0) + 1;
    }
  }

  return df;
}

/**
 * Calculate average document length
 */
function calculateAvgDocLength(skills: SkillEntry[]): number {
  if (skills.length === 0) return 0;

  const totalLength = skills.reduce((sum, skill) => {
    return sum + skill.keywords.length + skill.tokens.length;
  }, 0);

  return totalLength / skills.length;
}

/**
 * Build a skill index from all available skills
 */
export function buildIndex(additionalPaths: string[] = []): SkillIndex {
  const skills = scanAllSkillDirectories(additionalPaths);
  const documentFrequency = calculateDocumentFrequency(skills);
  const avgDocLength = calculateAvgDocLength(skills);

  return {
    version: 1,
    generated: new Date().toISOString(),
    skills,
    documentFrequency,
    avgDocLength,
  };
}

/**
 * Save index to a file
 */
export function saveIndex(index: SkillIndex, filePath: string): void {
  writeFileSync(filePath, JSON.stringify(index, null, 2), 'utf-8');
}

/**
 * Load index from a file
 */
export function loadIndex(filePath: string): SkillIndex | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as SkillIndex;
  } catch {
    return null;
  }
}
