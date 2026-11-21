/**
 * Pure, Runtime-Agnostic Text Sanitizer & Normalization Pipeline
 *
 * Shared single source of truth for both the browser ingestion UI/parsers
 * and the serverless grading engine (ES2020-safe, zero DOM/Node dependencies).
 */

const MOJIBAKE_MAP: Record<string, string> = {
  // Quotes & Apostrophes
  'â€™': "'",
  'â€˜': "'",
  'â€œ': '"',
  'â€\u009d': '"',
  'â€\u009c': '"',
  'â€š': "'",
  'â€ž': '"',
  'â€²': "'",
  'â€³': '"',
  'â€': '"', // Truncated right quote common in truncated Windows-1252 exports

  // Dashes, Hyphens, Bullets & Invisible Markers
  'â€“': '–',
  'â€”': '—',
  'â€¦': '…',
  'â€"': '—',
  'â€¢': '•',
  'â€\u2039': '', // Mojibake zero-width space (\u200B -> 0xE2 0x80 0x8B)
  'â€°': '‰', // Mojibake per-mille (\u2030 -> 0xE2 0x80 0xB0)

  // Invisible BOM & Spaces
  'ï»¿': '',
  'Â\u00A0': ' ',
  'Â ': ' ',

  // Math, Scientific & Units
  'Â±': '±',
  'Â°': '°',
  'Â²': '²',
  'Â³': '³',
  'Âµ': 'µ',
  'Â¼': '¼',
  'Â½': '½',
  'Â¾': '¾',
  'Â©': '©',
  'Â®': '®',
  'Ã—': '×',
  'Ã·': '÷',
  'â‰¤': '≤',
  'â‰¥': '≥',
  'â‰\u00A0': '≠',
  'â‰ˆ': '≈',
  'âˆš': '√',
  'âˆž': '∞',

  // Arrows
  'â†’': '→',
  'â†\u0090': '←',
  'â†‘': '↑',
  'â†“': '↓',
  'â†”': '↔',

  // Accents & Foreign Characters (Latin-1/UTF-8 Mojibake)
  'Ã©': 'é',
  'Ã¨': 'è',
  'Ãª': 'ê',
  'Ã«': 'ë',
  'Ã\u00A0': 'à',
  'Ã¡': 'á',
  'Ã¢': 'â',
  'Ã£': 'ã',
  'Ã¤': 'ä',
  'Ã¥': 'å',
  'Ã¦': 'æ',
  'Ã§': 'ç',
  'Ã¬': 'ì',
  'Ã\u00AD': 'í',
  'Ã®': 'î',
  'Ã¯': 'ï',
  'Ã±': 'ñ',
  'Ã²': 'ò',
  'Ã³': 'ó',
  'Ã´': 'ô',
  'Ãµ': 'õ',
  'Ã¶': 'ö',
  'Ã¹': 'ù',
  'Ãº': 'ú',
  'Ã»': 'û',
  'Ã¼': 'ü',
  'Ã½': 'ý',
  'Ã¿': 'ÿ',
  'Ã€': 'À',
  'Ã\u0081': 'Á',
  'Ã\u0089': 'É',
  'Ã\u0088': 'È',
  'Ã\u0091': 'Ñ',
  'Ã\u0093': 'Ó',

  // Greek Letters
  'Î±': 'α',
  'Î²': 'β',
  'Î³': 'γ',
  'Î´': 'δ',
  'Îµ': 'ε',
  'Î¶': 'ζ',
  'Î·': 'η',
  'Î¸': 'θ',
  'Î¹': 'ι',
  'Îº': 'κ',
  'Î»': 'λ',
  'Î¼': 'μ',
  'Î½': 'ν',
  'Î¾': 'ξ',
  'Î¿': 'ο',
  'Ï€': 'π',
  'Ï\u0081': 'ρ',
  'Ïƒ': 'σ',
  'Ï„': 'τ',
  'Ï…': 'υ',
  'Ï†': 'φ',
  'Ï‡': 'χ',
  'Ïˆ': 'ψ',
  'Ï‰': 'ω',
  'Î”': 'Δ',
  'Î£': 'Σ',
  'Î©': 'Ω',
  'Î\u00A0': 'Π',
};

const HTML_NAMED_ENTITIES: Record<string, string> = {
  // Common Punctuation & Quotes
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&#039;': "'",
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&sbquo;': "'",
  '&bdquo;': '"',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&bull;': '•',
  '&nbsp;': ' ',

  // Math & Logic Operators
  '&plusmn;': '±',
  '&times;': '×',
  '&divide;': '÷',
  '&le;': '≤',
  '&ge;': '≥',
  '&ne;': '≠',
  '&approx;': '≈',
  '&radic;': '√',
  '&infin;': '∞',
  '&prop;': '∝',
  '&ang;': '∠',
  '&perp;': '⊥',
  '&sim;': '∼',
  '&sum;': '∑',
  '&prod;': '∏',
  '&int;': '∫',
  '&part;': '∂',
  '&empty;': '∅',
  '&isin;': '∈',
  '&notin;': '∉',
  '&sub;': '⊂',
  '&sup;': '⊃',
  '&sube;': '⊆',
  '&supe;': '⊇',
  '&cap;': '∩',
  '&cup;': '∪',

  // Units, Fractions & Exponents
  '&deg;': '°',
  '&prime;': "'",
  '&Prime;': '"',
  '&sup1;': '¹',
  '&sup2;': '²',
  '&sup3;': '³',
  '&frac14;': '¼',
  '&frac12;': '½',
  '&frac34;': '¾',
  '&micro;': 'µ',
  '&permil;': '‰',

  // Greek Alphabet
  '&alpha;': 'α',
  '&beta;': 'β',
  '&gamma;': 'γ',
  '&delta;': 'δ',
  '&epsilon;': 'ε',
  '&zeta;': 'ζ',
  '&eta;': 'η',
  '&theta;': 'θ',
  '&iota;': 'ι',
  '&kappa;': 'κ',
  '&lambda;': 'λ',
  '&mu;': 'μ',
  '&nu;': 'ν',
  '&xi;': 'ξ',
  '&omicron;': 'ο',
  '&pi;': 'π',
  '&rho;': 'ρ',
  '&sigma;': 'σ',
  '&tau;': 'τ',
  '&upsilon;': 'υ',
  '&phi;': 'φ',
  '&chi;': 'χ',
  '&psi;': 'ψ',
  '&omega;': 'ω',
  '&Alpha;': 'Α',
  '&Beta;': 'Β',
  '&Gamma;': 'Γ',
  '&Delta;': 'Δ',
  '&Theta;': 'Θ',
  '&Lambda;': 'Λ',
  '&Sigma;': 'Σ',
  '&Omega;': 'Ω',

  // Arrows
  '&larr;': '←',
  '&uarr;': '↑',
  '&rarr;': '→',
  '&darr;': '↓',
  '&harr;': '↔',
  '&rArr;': '⇒',
  '&lArr;': '⇐',
  '&hArr;': '⇔',

  // Legal & Miscellaneous
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&sect;': '§',

  // Basic HTML Tags / Characters
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
};

const SORTED_MOJIBAKE_ENTRIES = Object.entries(MOJIBAKE_MAP).sort(([a], [b]) => b.length - a.length);
const SORTED_HTML_ENTRIES = Object.entries(HTML_NAMED_ENTITIES).sort(([a], [b]) => b.length - a.length);

/** ES2020-safe literal substring replacement. */
function replaceAllLiteral(str: string, search: string, replacement: string): string {
  return str.includes(search) ? str.split(search).join(replacement) : str;
}

/** Strips ASCII control characters (< 0x20) except tab (\t), LF (\n), and CR (\r). */
function stripControlChars(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 || code === 9 || code === 10 || code === 13) {
      out += text[i];
    }
  }
  return out;
}

/**
 * Repairs mojibake character sequences caused by UTF-8 bytes being decoded as Windows-1252/Latin-1.
 */
export function repairMojibake(text: string): string {
  if (!text) return '';
  let result = text;

  // Replace longer mojibake patterns first to avoid partial matches
  for (const [bad, good] of SORTED_MOJIBAKE_ENTRIES) {
    result = replaceAllLiteral(result, bad, good);
  }

  return result;
}

/**
 * Decodes HTML entities (named, decimal &#123;, hex &#x1F;).
 * Supports multi-pass to unwrap double-escaped entities like &amp;quot; -> ".
 */
export function decodeHTMLEntities(text: string): string {
  if (!text || !text.includes('&')) return text;

  let decoded = text;
  let passes = 0;

  while (passes < 2 && decoded.includes('&') && /&(?:[a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/.test(decoded)) {
    passes++;

    // 1. Numeric decimal entities &#123;
    decoded = decoded.replace(/&#(\d+);/g, (raw, code: string) => {
      try {
        const num = parseInt(code, 10);
        return num > 0 ? String.fromCodePoint(num) : raw;
      } catch {
        return raw;
      }
    });

    // 2. Numeric hex entities &#x1F;
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (raw, hex: string) => {
      try {
        const num = parseInt(hex, 16);
        return num > 0 ? String.fromCodePoint(num) : raw;
      } catch {
        return raw;
      }
    });

    // 3. Named entities (decode &amp; last in pass)
    for (const [entity, char] of SORTED_HTML_ENTRIES) {
      if (entity !== '&amp;') {
        decoded = replaceAllLiteral(decoded, entity, char);
      }
    }

    decoded = replaceAllLiteral(decoded, '&amp;', '&');
  }

  return decoded;
}

/**
 * Contextual Repair for Unicode Replacement Characters (\uFFFD /  / ï¿½).
 *
 * Catches corrupt characters resulting from decoding Windows-1252/ANSI text
 * in UTF-8 replacement mode (e.g. curly apostrophes in "babys" -> "baby's",
 * contractions like "dont" -> "don't", temperatures like "37C" -> "37°C",
 * tolerances like "5%" -> "±5%", paired quotes, and plural possessives).
 */
export function repairReplacementCharacters(text: string): string {
  if (!text || (!text.includes('\uFFFD') && !text.includes('ï¿½'))) {
    return text;
  }

  // 1. Normalize Latin-1/Windows-1252 mojibake of \uFFFD (ï¿½) to standard \uFFFD
  let str = text.replace(/ï¿½/g, '\uFFFD');

  // 2. Contractions & possessives between letters (e.g. babys -> baby's, dont -> don't, patients -> patient's)
  str = str.replace(/([\p{L}])\uFFFD([\p{L}])/gu, "$1'$2");

  // 3. Contractions & possessives with whitespace or digit (e.g. baby s -> baby's, 1990s -> 1990's)
  str = str.replace(/([\p{L}])\s*\uFFFD\s*([sS])\b/gu, "$1'$2");
  str = str.replace(/(\d+)\uFFFD([sS])\b/g, "$1'$2");

  // 4. Temperatures and degrees (e.g. 37C -> 37°C, 98.6F -> 98.6°F, 90 angle -> 90° angle)
  str = str.replace(/(\d+(?:\.\d+)?)\s*\uFFFD\s*([CFcf])\b/g, '$1°$2');
  str = str.replace(
    /(\d+(?:\.\d+)?)\s*\uFFFD(?=\s*(?:angle|arc|rotation|latitude|longitude|phase|tilt|turn|clockwise|counter|degrees?)\b)/gi,
    '$1°'
  );

  // 5. Tolerances & Plus-Minus (e.g. 5% -> ±5%, 50  5 -> 50 ± 5)
  str = str.replace(/(^|[\s(])\uFFFD(\s*)(\d+(?:\.\d+)?%?)/g, '$1±$2$3');

  // 6. Numeric ranges / dashes (e.g. 19391945 -> 1939–1945, pp. 1215 -> pp. 12–15)
  str = str.replace(/(\d+)\s*\uFFFD\s*(\d+)/g, '$1–$2');

  // 7. Paired quotes wrapping words or phrases (e.g. mitosis -> "mitosis")
  str = str.replace(/(^|[\s(\[{])\uFFFD([^\uFFFD\r\n]+?)\uFFFD(?=[\s)\]},.;:!?]|$)/g, '$1"$2"');

  // 8. Plural possessives at word boundaries (e.g. patients records -> patients' records)
  str = str.replace(/\b([a-zA-Z]{2,}s)\uFFFD(?=[\s\.,;:!?\)\"\'\]\}]|$)/g, "$1'");

  // 9. Bullets at line start
  str = str.replace(/(^|\n)\s*\uFFFD\s+/g, '$1• ');

  // 10. Word-boundary quotes (e.g. quote -> "quote, quote -> quote")
  str = str.replace(/(^|[\s(\[{])\uFFFD(?=[\p{L}0-9])/gu, '$1"');
  str = str.replace(/(?<=[\p{L}0-9])\uFFFD(?=[\s)\]},.;:!?]|$)/gu, '"');

  // 11. Remove any remaining stray orphan replacement characters so no diamond glyphs appear
  str = str.replace(/\uFFFD+/g, '');

  return str;
}

/**
 * Strips zero-width characters, BOM, and non-printable control characters,
 * and normalizes non-breaking spaces (\u00A0) to standard spaces.
 */
export function normalizeWhitespaceAndInvisible(text: string): string {
  if (!text) return '';

  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/(?:\u200B|\u200C|\u200D|\u2060|\uFEFF|\u00AD)/g, '')
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\u3000]/g, ' ');

  return stripControlChars(cleaned);
}

/**
 * Normalizes typographical ligatures (ﬁ -> fi) and smart quotes/hyphens
 * while preserving ASCII backticks (`) for code snippets.
 */
export function normalizeQuotesAndLigatures(text: string): string {
  if (!text) return '';

  return text
    // Ligatures
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    // Smart Single Quotes & Apostrophes (preserves ASCII backtick `\u0060`)
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4]/g, "'")
    // Smart Double Quotes
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    // Non-breaking hyphens to standard hyphen
    .replace(/\u2011/g, '-');
}

/**
 * Master Text Sanitizer for Question & Option Text.
 * Chains mojibake repair, HTML entity decoding, whitespace normalization,
 * and typography cleanup while preserving math symbols and code backticks.
 */
export function sanitizeQuestionText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str.trim()) return '';

  let result = repairMojibake(str);
  result = decodeHTMLEntities(result);
  result = repairReplacementCharacters(result);
  result = normalizeWhitespaceAndInvisible(result);
  result = normalizeQuotesAndLigatures(result);

  return result.trim();
}

/**
 * Normalizes text for comparing answer strings across frontend & backend grading.
 * Preserves quote tokens so `"42"` never falsely matches unquoted `42`.
 */
export function normalizeAnswerForMatching(text: string | null | undefined): string {
  if (!text) return '';
  return sanitizeQuestionText(text)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

