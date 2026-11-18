/**
 * Comprehensive Text Sanitizer & Encoding Normalizer for CBT Ingestion
 * 
 * Solves:
 * 1. Windows-1252 / ANSI file encoding mismatches (e.g. from Excel on Windows).
 * 2. Mojibake corruption (e.g. â€™, Â±, Â°, â€œ, Ã©, etc.).
 * 3. HTML entities (&quot;, &#39;, &plusmn;, &le;, &ge;, &deg;, etc.).
 * 4. Invisible & zero-width characters (\u200B, \uFEFF, \u00AD) that break regex matching.
 * 5. Non-breaking spaces (\u00A0) and typography ligatures (ﬁ -> fi).
 * 6. Preserves mathematical, scientific, and Greek symbols (±, ×, ÷, ≤, ≥, ≠, ≈, √, π, °, ², ³, μ, Ω).
 */

const MOJIBAKE_MAP: Record<string, string> = {
  // Quotes & Apostrophes
  'â€™': "'",
  'â€˜': "'",
  'â€œ': '"',
  'â€\u009d': '"',
  'â€\u009c': '"',
  'â€ ': '"',
  'â€š': "'",
  'â€ž': '"',
  'â€²': "'",
  'â€³': '"',
  'â€': '"', // Truncated right quote common in truncated Windows-1252 exports

  // Dashes, Hyphens & Ellipses
  'â€“': '–',
  'â€”': '—',
  'â€¦': '…',
  'â€"': '—',
  'â€¢': '•',

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
  'Ã ': 'à',
  'Ã¡': 'á',
  'Ã¢': 'â',
  'Ã£': 'ã',
  'Ã¤': 'ä',
  'Ã¥': 'å',
  'Ã¦': 'æ',
  'Ã§': 'ç',
  'Ã¬': 'ì',
  'Ã­': 'í',
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
  'Î ': 'Π'
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
  '&amp;': '&'
};

const SORTED_MOJIBAKE_ENTRIES = Object.entries(MOJIBAKE_MAP).sort(([a], [b]) => b.length - a.length);
const SORTED_HTML_ENTRIES = Object.entries(HTML_NAMED_ENTITIES).sort(([a], [b]) => b.length - a.length);

/**
 * Repairs mojibake character sequences caused by UTF-8 bytes being decoded as Windows-1252/Latin-1.
 */
export function repairMojibake(text: string): string {
  if (!text) return '';
  let result = text;

  // Replace longer mojibake patterns first to avoid partial matches
  for (const [bad, good] of SORTED_MOJIBAKE_ENTRIES) {
    if (result.includes(bad)) {
      result = result.replaceAll(bad, good);
    }
  }

  return result;
}

/**
 * Decodes all HTML entities (named, decimal &#123;, hex &#x1F;)
 * Supports multi-pass to unwrap double-escaped entities like &amp;quot; -> "
 */
export function decodeHTMLEntities(text: string): string {
  if (!text || !text.includes('&')) return text;

  let decoded = text;
  let passes = 0;

  while (passes < 2 && decoded.includes('&') && /&(?:[a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/.test(decoded)) {
    passes++;

    // 1. Numeric decimal entities &#123;
    decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
      try {
        const num = parseInt(code, 10);
        return num > 0 ? String.fromCodePoint(num) : _;
      } catch {
        return _;
      }
    });

    // 2. Numeric hex entities &#x1F;
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        const num = parseInt(hex, 16);
        return num > 0 ? String.fromCodePoint(num) : _;
      } catch {
        return _;
      }
    });

    // 3. Named entities (decode &amp; last in pass)
    for (const [entity, char] of SORTED_HTML_ENTRIES) {
      if (entity !== '&amp;' && decoded.includes(entity)) {
        decoded = decoded.replaceAll(entity, char);
      }
    }

    if (decoded.includes('&amp;')) {
      decoded = decoded.replaceAll('&amp;', '&');
    }
  }

  return decoded;
}

/**
 * Strips zero-width characters, BOM, and non-printable control characters,
 * and normalizes non-breaking spaces (\u00A0) to standard spaces.
 */
export function normalizeWhitespaceAndInvisible(text: string): string {
  if (!text) return '';

  return text
    // Strip BOM
    .replace(/^\uFEFF/, '')
    // Strip zero-width & invisible characters
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF\u00AD]/g, '')
    // Normalize non-breaking and special spaces to standard ASCII space
    .replace(/[\u00A0\u202F\u2007\u2008\u2009\u200A\u3000]/g, ' ')
    // Strip non-printable ASCII control characters (keeping \t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Normalizes typographical ligatures (ﬁ -> fi) and smart quotes/dashes to standard clean characters.
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
    // Smart Single Quotes & Apostrophes
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u0060\u00B4]/g, "'")
    // Smart Double Quotes
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    // Non-breaking hyphens to standard hyphen
    .replace(/\u2011/g, '-');
}

/**
 * Master Text Sanitizer for Question & Option Text
 * 
 * Chains mojibake repair, HTML entity decoding, whitespace normalization,
 * and typography cleanup while strictly preserving mathematical & scientific symbols.
 * 
 * Safe and idempotent.
 */
export function sanitizeQuestionText(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str.trim()) return '';

  // 1. Repair Mojibake
  let result = repairMojibake(str);

  // 2. Decode HTML Entities
  result = decodeHTMLEntities(result);

  // 3. Remove invisible characters & normalize whitespace
  result = normalizeWhitespaceAndInvisible(result);

  // 4. Normalize quotes and ligatures
  result = normalizeQuotesAndLigatures(result);

  return result.trim();
}

/**
 * Decodes an ArrayBuffer uploaded from the browser (e.g. .csv, .txt, .aiken)
 * with automatic encoding detection:
 * 1. Checks BOM for UTF-8, UTF-16LE, UTF-16BE.
 * 2. Attempts strict UTF-8 decoding.
 * 3. Falls back to Windows-1252 / ANSI if UTF-8 fails (common for Excel CSVs on Windows).
 */
export function decodeTextBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return '';

  // 1. Check for UTF-8 BOM: 0xEF, 0xBB, 0xBF
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    const textDecoder = new TextDecoder('utf-8');
    return sanitizeQuestionText(textDecoder.decode(bytes.subarray(3)));
  }

  // 2. Check for UTF-16LE BOM: 0xFF, 0xFE
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    const textDecoder = new TextDecoder('utf-16le');
    return sanitizeQuestionText(textDecoder.decode(bytes.subarray(2)));
  }

  // 3. Check for UTF-16BE BOM: 0xFE, 0xFF
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    const textDecoder = new TextDecoder('utf-16be');
    return sanitizeQuestionText(textDecoder.decode(bytes.subarray(2)));
  }

  // 4. Attempt Strict UTF-8 Decoding
  try {
    const strictDecoder = new TextDecoder('utf-8', { fatal: true });
    const decoded = strictDecoder.decode(bytes);
    return sanitizeQuestionText(decoded);
  } catch {
    // 5. Fallback to Windows-1252 / ANSI (Excel default on Windows)
    try {
      const win1252Decoder = new TextDecoder('windows-1252');
      const decoded = win1252Decoder.decode(bytes);
      return sanitizeQuestionText(decoded);
    } catch {
      // Last-resort relaxed UTF-8
      const relaxedDecoder = new TextDecoder('utf-8');
      return sanitizeQuestionText(relaxedDecoder.decode(bytes));
    }
  }
}

/**
 * Normalizes text for comparing student/lecturer answer strings.
 * Trims, removes outer quotes, converts curly quotes to straight, collapses multi-spaces, and lowercases.
 */
export function normalizeAnswerForMatching(text: string): string {
  if (!text) return '';
  return sanitizeQuestionText(text)
    .replace(/^["']+|["']+$/g, '') // remove outer quote wrappers
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
