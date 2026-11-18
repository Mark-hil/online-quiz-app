import { describe, it, expect } from 'vitest';
import {
  repairMojibake,
  decodeHTMLEntities,
  normalizeWhitespaceAndInvisible,
  normalizeQuotesAndLigatures,
  sanitizeQuestionText,
  decodeTextBuffer,
  normalizeAnswerForMatching
} from '../src/utils/textSanitizer';

describe('textSanitizer', () => {
  describe('repairMojibake', () => {
    it('repairs curly quotes and apostrophes', () => {
      expect(repairMojibake('Whatâ€™s your name?')).toBe("What's your name?");
      expect(repairMojibake('He said â€œhelloâ€ ')).toBe('He said "hello"');
      expect(repairMojibake('â€˜quoteâ€™')).toBe("'quote'");
    });

    it('repairs typographical dashes and ellipses', () => {
      expect(repairMojibake('Years 1939â€“1945')).toBe('Years 1939–1945');
      expect(repairMojibake('Waitâ€”did you hear that?')).toBe('Wait—did you hear that?');
      expect(repairMojibake('Loadingâ€¦')).toBe('Loading…');
    });

    it('repairs mathematical and scientific symbols', () => {
      expect(repairMojibake('25Â°C Â± 2Â°C')).toBe('25°C ± 2°C');
      expect(repairMojibake('Area = 50 mÂ²')).toBe('Area = 50 m²');
      expect(repairMojibake('Volume = 100 mÂ³')).toBe('Volume = 100 m³');
      expect(repairMojibake('Current: 10 ÂµA')).toBe('Current: 10 µA');
      expect(repairMojibake('10 Ã— 5 Ã· 2')).toBe('10 × 5 ÷ 2');
      expect(repairMojibake('x â‰¤ 10 and y â‰¥ 5')).toBe('x ≤ 10 and y ≥ 5');
      expect(repairMojibake('a â‰  b')).toBe('a ≠ b');
      expect(repairMojibake('f(x) = âˆš(xÂ² + 1)')).toBe('f(x) = √(x² + 1)');
      expect(repairMojibake('Approximation: x â‰ˆ 3.14')).toBe('Approximation: x ≈ 3.14');
    });

    it('repairs Greek characters and accents', () => {
      expect(repairMojibake('Angles: Î± + Î² = Î³')).toBe('Angles: α + β = γ');
      expect(repairMojibake('Resistance: 100 Î©')).toBe('Resistance: 100 Ω');
      expect(repairMojibake('Circle constant: Ï€')).toBe('Circle constant: π');
      expect(repairMojibake('cafÃ© and faÃ§ade')).toBe('café and façade');
      expect(repairMojibake('seÃ±or')).toBe('señor');
    });

    it('strips legacy mojibake BOM markers and spaces', () => {
      expect(repairMojibake('ï»¿What is 2+2?')).toBe('What is 2+2?');
      expect(repairMojibake('OptionÂ A')).toBe('Option A');
    });
  });

  describe('decodeHTMLEntities', () => {
    it('decodes standard HTML quotes and ampersands', () => {
      expect(decodeHTMLEntities('What is &quot;OOP&quot;?')).toBe('What is "OOP"?');
      expect(decodeHTMLEntities('Don&#39;t do this')).toBe("Don't do this");
      expect(decodeHTMLEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
      expect(decodeHTMLEntities('&lt;div&gt;tag&lt;/div&gt;')).toBe('<div>tag</div>');
    });

    it('decodes mathematical and scientific HTML entities', () => {
      expect(decodeHTMLEntities('5 &plusmn; 2')).toBe('5 ± 2');
      expect(decodeHTMLEntities('10 &times; 5 = 50')).toBe('10 × 5 = 50');
      expect(decodeHTMLEntities('100 &divide; 2')).toBe('100 ÷ 2');
      expect(decodeHTMLEntities('x &le; 10 &amp;&amp; y &ge; 5')).toBe('x ≤ 10 && y ≥ 5');
      expect(decodeHTMLEntities('a &ne; b')).toBe('a ≠ b');
      expect(decodeHTMLEntities('&radic;16 = 4')).toBe('√16 = 4');
      expect(decodeHTMLEntities('100&deg;C')).toBe('100°C');
      expect(decodeHTMLEntities('x&sup2; + y&sup2;')).toBe('x² + y²');
      expect(decodeHTMLEntities('&alpha; + &beta; = 90&deg;')).toBe('α + β = 90°');
    });

    it('decodes decimal and hexadecimal numeric entities', () => {
      expect(decodeHTMLEntities('&#177; 5')).toBe('± 5');
      expect(decodeHTMLEntities('&#8804; 10')).toBe('≤ 10');
      expect(decodeHTMLEntities('&#x2264; 10')).toBe('≤ 10');
      expect(decodeHTMLEntities('&#176;C')).toBe('°C');
    });

    it('handles double-escaped entities cleanly', () => {
      expect(decodeHTMLEntities('&amp;quot;Hello&amp;quot;')).toBe('"Hello"');
      expect(decodeHTMLEntities('&amp;plusmn;')).toBe('±');
      expect(decodeHTMLEntities('&amp;amp;')).toBe('&');
    });
  });

  describe('normalizeWhitespaceAndInvisible', () => {
    it('strips zero-width spaces that break regex matching', () => {
      const withZeroWidth = '\u200B1. What is recursion?\u200C';
      expect(normalizeWhitespaceAndInvisible(withZeroWidth)).toBe('1. What is recursion?');
    });

    it('normalizes non-breaking spaces to standard ASCII space', () => {
      const withNBSP = 'A.\u00A0First\u202Foption';
      expect(normalizeWhitespaceAndInvisible(withNBSP)).toBe('A. First option');
    });

    it('strips BOM and control characters while preserving newlines', () => {
      const withControl = '\uFEFFLine 1\x00\x07\nLine 2\tTabbed';
      expect(normalizeWhitespaceAndInvisible(withControl)).toBe('Line 1\nLine 2\tTabbed');
    });
  });

  describe('normalizeQuotesAndLigatures', () => {
    it('converts ligatures to plain character combinations', () => {
      expect(normalizeQuotesAndLigatures('deﬁnition and ﬂow')).toBe('definition and flow');
      expect(normalizeQuotesAndLigatures('oﬃce and buﬀer')).toBe('office and buffer');
    });

    it('normalizes smart/curly quotes to standard straight quotes', () => {
      expect(normalizeQuotesAndLigatures('“Hello” and ‘World’')).toBe('"Hello" and \'World\'');
      expect(normalizeQuotesAndLigatures('«French quotes»')).toBe('"French quotes"');
    });
  });

  describe('sanitizeQuestionText', () => {
    it('safely runs the master pipeline on messy inputs', () => {
      const input = '\u200BWhatâ€™s &quot;OOP&quot;? &plusmn;5Â°C\u00A0[2 Marks]';
      const output = sanitizeQuestionText(input);
      expect(output).toBe('What\'s "OOP"? ±5°C [2 Marks]');
    });

    it('strictly preserves mathematical equations and Greek variables', () => {
      const math = 'Solve for x: 3x² + 4x - 5 = 0, where α and β are roots.';
      expect(sanitizeQuestionText(math)).toBe(math);
    });

    it('is idempotent and handles null/undefined safely', () => {
      expect(sanitizeQuestionText(null)).toBe('');
      expect(sanitizeQuestionText(undefined)).toBe('');
      const clean = 'What is 2 + 2?';
      expect(sanitizeQuestionText(clean)).toBe(clean);
      expect(sanitizeQuestionText(sanitizeQuestionText(clean))).toBe(clean);
    });
  });

  describe('decodeTextBuffer', () => {
    it('decodes Windows-1252 / ANSI bytes correctly (Excel on Windows default)', () => {
      // "Don’t ± 5" in Windows-1252 bytes:
      // D(0x44) o(0x6F) n(0x6E) ’(0x92) t(0x74) ' '(0x20) ±(0xB1) ' '(0x20) 5(0x35)
      const win1252Bytes = new Uint8Array([0x44, 0x6F, 0x6E, 0x92, 0x74, 0x20, 0xB1, 0x20, 0x35]);
      const decoded = decodeTextBuffer(win1252Bytes.buffer);
      expect(decoded).toBe("Don't ± 5");
    });

    it('decodes UTF-8 with BOM correctly', () => {
      // BOM: 0xEF, 0xBB, 0xBF followed by "Hello"
      const utf8WithBom = new Uint8Array([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
      const decoded = decodeTextBuffer(utf8WithBom.buffer);
      expect(decoded).toBe('Hello');
    });

    it('decodes standard UTF-8 buffer correctly', () => {
      const encoder = new TextEncoder();
      const bytes = encoder.encode('Question: α + β ≤ 100°');
      const decoded = decodeTextBuffer(bytes.buffer);
      expect(decoded).toBe('Question: α + β ≤ 100°');
    });
  });

  describe('normalizeAnswerForMatching', () => {
    it('matches answers regardless of smart quotes, whitespace, or casing', () => {
      const lecturerKey = 'Don’t know';
      const studentOption = '  "Don\'t know"  ';
      expect(normalizeAnswerForMatching(lecturerKey)).toBe(normalizeAnswerForMatching(studentOption));
    });

    it('matches options with non-breaking spaces or multi-spaces', () => {
      const opt1 = 'Option\u00A0A:\u00A0\u00A0True';
      const opt2 = 'Option A: True';
      expect(normalizeAnswerForMatching(opt1)).toBe(normalizeAnswerForMatching(opt2));
    });
  });
});

