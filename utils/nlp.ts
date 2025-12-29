/**
 * 🧠 NLP Utilities — Lightweight Text Processing for ACE
 * 
 * Features:
 * - Tokenization with German stopword filtering
 * - Set intersection for keyword extraction
 * - Fast local processing (no API calls)
 */

// ============================================================================
// STOPWORDS (German + English Common)
// ============================================================================

const STOPWORDS = new Set([
    // German
    'der', 'die', 'das', 'und', 'ist', 'in', 'zu', 'den', 'für', 'von', 'mit',
    'auf', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'er', 'hat',
    'aus', 'bei', 'sie', 'nach', 'wird', 'noch', 'wie', 'über', 'so', 'zum',
    'kann', 'nur', 'wenn', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch',
    'man', 'sehr', 'was', 'muss', 'wurde', 'sein', 'schon', 'dem', 'sind',
    'ich', 'du', 'wir', 'ihr', 'mir', 'mich', 'dir', 'dich', 'sich', 'uns',
    'euch', 'ihm', 'ihn', 'ihr', 'mein', 'dein', 'sein', 'unser', 'euer',
    'haben', 'habe', 'hatte', 'werden', 'wurde', 'worden', 'sein', 'war',
    'waren', 'gewesen', 'bin', 'bist', 'seid', 'sind', 'werde', 'wirst',
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further',
    'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
    'might', 'must', 'shall', 'can', 'it', 'its', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which', 'who',
    'whom', 'my', 'your', 'his', 'her', 'our', 'their'
]);

// ============================================================================
// TOKENIZATION
// ============================================================================

/**
 * Tokenizes text into meaningful words.
 * 
 * - Converts to lowercase
 * - Removes punctuation
 * - Filters stopwords
 * - Filters short words (< 3 chars)
 * 
 * @param text Input text to tokenize
 * @returns Array of meaningful words
 */
export const tokenize = (text: string): string[] => {
    return text
        .toLowerCase()
        // Remove punctuation and special characters
        .replace(/[^\w\säöüß]/g, ' ')
        // Split on whitespace
        .split(/\s+/)
        // Filter: min 3 chars, not a stopword, not a number
        .filter(word =>
            word.length >= 3 &&
            !STOPWORDS.has(word) &&
            !/^\d+$/.test(word)
        );
};

/**
 * Advanced tokenization with frequency counting
 */
export const tokenizeWithFrequency = (text: string): Map<string, number> => {
    const tokens = tokenize(text);
    const frequency = new Map<string, number>();

    for (const token of tokens) {
        frequency.set(token, (frequency.get(token) || 0) + 1);
    }

    return frequency;
};

// ============================================================================
// SET OPERATIONS
// ============================================================================

/**
 * Returns the intersection of two string arrays.
 * Fast implementation for keyword matching.
 * 
 * @param arrA First array of words
 * @param arrB Second array of words  
 * @returns Array of words that appear in both
 */
export const intersection = (arrA: string[], arrB: string[]): string[] => {
    const setB = new Set(arrB);
    const result: string[] = [];
    const seen = new Set<string>();

    for (const word of arrA) {
        if (setB.has(word) && !seen.has(word)) {
            result.push(word);
            seen.add(word);
        }
    }

    return result;
};

/**
 * Returns words unique to arrA (not in arrB)
 */
export const difference = (arrA: string[], arrB: string[]): string[] => {
    const setB = new Set(arrB);
    return arrA.filter(word => !setB.has(word));
};

/**
 * Returns the union of two arrays (unique words from both)
 */
export const union = (arrA: string[], arrB: string[]): string[] => {
    return [...new Set([...arrA, ...arrB])];
};

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Extracts the most important keywords from text.
 * Uses simple TF-based scoring (no IDF, optimized for local speed).
 * 
 * @param text Input text
 * @param maxKeywords Maximum keywords to return
 * @returns Array of keywords sorted by importance
 */
export const extractKeywords = (text: string, maxKeywords = 5): string[] => {
    const frequency = tokenizeWithFrequency(text);

    // Sort by frequency, then alphabetically for consistency
    const sorted = [...frequency.entries()]
        .sort((a, b) => {
            if (b[1] !== a[1]) return b[1] - a[1];
            return a[0].localeCompare(b[0]);
        })
        .slice(0, maxKeywords)
        .map(([word]) => word);

    return sorted;
};

/**
 * Finds shared keywords between two texts.
 * This is the core function for ACE's "reason" generation.
 * 
 * @param textA First text
 * @param textB Second text
 * @param maxShared Maximum shared keywords to return
 * @returns Array of shared keywords
 */
export const findSharedKeywords = (
    textA: string,
    textB: string,
    maxShared = 3
): string[] => {
    const tokensA = tokenize(textA);
    const tokensB = tokenize(textB);
    const shared = intersection(tokensA, tokensB);

    // Prioritize longer words (usually more meaningful)
    shared.sort((a, b) => b.length - a.length);

    return shared.slice(0, maxShared);
};

// ============================================================================
// REASON BUILDING (for ACE)
// ============================================================================

/**
 * Builds a human-readable reason string for a connection.
 * Used by ACE to explain why a node was suggested.
 * 
 * @param inputText The user's current input
 * @param matchText The content of the matched node
 * @returns Localized reason string
 */
export const buildConnectionReason = (
    inputText: string,
    matchText: string
): string => {
    const shared = findSharedKeywords(inputText, matchText, 2);

    if (shared.length === 0) {
        return 'Ähnlicher Kontext'; // Fallback: semantic match without keyword overlap
    }

    if (shared.length === 1) {
        return `Erwähnt: "${shared[0]}"`;
    }

    // Format: "Beide erwähnen: 'keyword1', 'keyword2'"
    return `Beide erwähnen: "${shared.join('", "')}"`;
};

/**
 * Extracts shared context formatted for UI display (Trust Engine).
 * "Verbindung: Berlin, Budget"
 */
export const extractSharedContext = (input: string, target: string): string | null => {
    const t1 = new Set(tokenize(input));
    const t2 = tokenize(target);

    // Find intersection
    const shared = t2.filter(x => t1.has(x));

    if (shared.length > 0) {
        // Unique, Capitalized, Max 3
        const unique = [...new Set(shared)];
        return unique
            .slice(0, 3)
            .map(s => s.charAt(0).toUpperCase() + s.slice(1))
            .join(", ");
    }

    return null;
};
