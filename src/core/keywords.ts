/**
 * Common English stopwords to filter out during tokenization
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
  'has', 'have', 'he', 'her', 'his', 'how', 'i', 'if', 'in', 'is', 'it', 'its',
  'just', 'may', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'own',
  'say', 'she', 'so', 'some', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'up', 'us',
  'use', 'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while',
  'who', 'why', 'will', 'with', 'would', 'you', 'your',
  // Common markdown/doc words
  'example', 'see', 'note', 'using', 'used', 'uses',
]);

/**
 * Minimum token length to include
 */
const MIN_TOKEN_LENGTH = 2;

/**
 * Tokenize text into lowercase words, removing punctuation and stopwords
 */
export function tokenize(text: string): string[] {
  // Convert to lowercase and split on non-word characters
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= MIN_TOKEN_LENGTH);

  // Remove stopwords and duplicates
  const tokens = words.filter((word) => !STOPWORDS.has(word));

  return tokens;
}

/**
 * Extract unique tokens from text
 */
export function extractUniqueTokens(text: string): string[] {
  return [...new Set(tokenize(text))];
}

/**
 * Extract keywords from a ## Keywords section in markdown
 * Looks for a section header and extracts comma-separated or list items
 */
export function extractKeywordsSection(content: string): string[] {
  // Look for ## Keywords or ## keywords section
  const keywordsMatch = content.match(/##\s*keywords?\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (!keywordsMatch) {
    return [];
  }

  const keywordsBlock = keywordsMatch[1].trim();
  const keywords: string[] = [];

  // Handle comma-separated format: "keyword1, keyword2, keyword3"
  if (!keywordsBlock.includes('\n') || keywordsBlock.includes(',')) {
    const commaKeywords = keywordsBlock
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= MIN_TOKEN_LENGTH);
    keywords.push(...commaKeywords);
  }

  // Handle list format: "- keyword1\n- keyword2"
  const listMatches = keywordsBlock.matchAll(/^[-*]\s*(.+)$/gm);
  for (const match of listMatches) {
    const keyword = match[1].trim().toLowerCase();
    if (keyword.length >= MIN_TOKEN_LENGTH) {
      keywords.push(keyword);
    }
  }

  return [...new Set(keywords)];
}

/**
 * Extract all keywords from skill content
 * Combines explicit keywords section with tokenized description
 */
export function extractKeywords(description: string, content: string): string[] {
  const explicitKeywords = extractKeywordsSection(content);
  const descriptionTokens = extractUniqueTokens(description);

  // Combine and deduplicate
  return [...new Set([...explicitKeywords, ...descriptionTokens])];
}

/**
 * Tokenize a query message for matching
 */
export function tokenizeQuery(message: string): string[] {
  return tokenize(message);
}
