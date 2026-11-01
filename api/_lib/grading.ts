// Server-side grading and option matching utilities

export function parseOptions(rawOptions: any): string[] {
  if (!rawOptions) return [];

  const unwrapValue = (val: any, depth = 0): any => {
    if (depth > 6 || val === null || val === undefined) return val;

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (
        (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          return unwrapValue(parsed, depth + 1);
        } catch {
          return trimmed;
        }
      }
      return trimmed;
    }

    if (Array.isArray(val)) {
      const nonBlank = val.filter(item => item !== '' && item !== null && item !== undefined);
      if (nonBlank.length === 1 && typeof nonBlank[0] === 'string') {
        const candidate = unwrapValue(nonBlank[0], depth + 1);
        if (Array.isArray(candidate)) {
          return candidate;
        }
      }

      return val.map(item => {
        const unwrappedItem = unwrapValue(item, depth + 1);
        return typeof unwrappedItem === 'string' || typeof unwrappedItem === 'number'
          ? String(unwrappedItem)
          : Array.isArray(unwrappedItem)
            ? unwrappedItem.join(', ')
            : JSON.stringify(unwrappedItem);
      });
    }

    if (typeof val === 'object') {
      return Object.values(val).map(String);
    }

    return val;
  };

  const parsed = unwrapValue(rawOptions);

  if (Array.isArray(parsed)) {
    return parsed.map(item => String(item ?? '').trim());
  }

  if (parsed && typeof parsed === 'object') {
    return Object.values(parsed).map(item => String(item ?? '').trim());
  }

  const str = String(parsed ?? '').trim();
  return str ? [str] : [];
}

export function isAnswerCorrect(
  studentAnswer: string | undefined | null,
  correctAnswer: string | undefined | null,
  rawOptions?: any,
  questionType?: string
): boolean {
  if (studentAnswer === undefined || studentAnswer === null || correctAnswer === undefined || correctAnswer === null) {
    return false;
  }

  const sAns = String(studentAnswer).trim();
  const cAns = String(correctAnswer).trim();

  if (!sAns || !cAns) return false;

  // 1. Direct case-insensitive match
  if (sAns.toLowerCase() === cAns.toLowerCase()) {
    return true;
  }

  // 2. True / False normalization
  if (questionType === 'true_false') {
    const normalizeTf = (val: string) => {
      const v = val.toLowerCase().trim();
      if (['true', 't', '1', 'a'].includes(v)) return 'true';
      if (['false', 'f', '0', 'b'].includes(v)) return 'false';
      return v;
    };
    return normalizeTf(sAns) === normalizeTf(cAns);
  }

  // 3. Option letter <-> option text matching
  const options = parseOptions(rawOptions);
  if (options.length > 0) {
    // If correct answer is a letter (e.g. 'A', 'B', 'C', 'D'...)
    if (/^[A-Za-z]$/.test(cAns)) {
      const optIndex = cAns.toUpperCase().charCodeAt(0) - 65;
      if (optIndex >= 0 && optIndex < options.length) {
        const expectedOptionText = options[optIndex];
        if (sAns.toLowerCase() === expectedOptionText.toLowerCase()) {
          return true;
        }
      }
    }

    // If correct answer is a numeric index (e.g. '0', '1', '2'...)
    if (/^\d+$/.test(cAns)) {
      const optIndex = parseInt(cAns, 10);
      if (optIndex >= 0 && optIndex < options.length) {
        const expectedOptionText = options[optIndex];
        if (sAns.toLowerCase() === expectedOptionText.toLowerCase()) {
          return true;
        }
      }
    }

    // If student answer is a letter (e.g. 'B') and correct answer is option text (e.g. '4')
    if (/^[A-Za-z]$/.test(sAns)) {
      const optIndex = sAns.toUpperCase().charCodeAt(0) - 65;
      if (optIndex >= 0 && optIndex < options.length) {
        const studentOptionText = options[optIndex];
        if (studentOptionText.toLowerCase() === cAns.toLowerCase()) {
          return true;
        }
      }
    }

    // Strip common option prefixes like "A. ", "B) ", "(C) "
    const stripPrefix = (val: string) => val.replace(/^(\([A-Za-z]\)|[A-Za-z][.)])\s*/, '').trim().toLowerCase();
    if (stripPrefix(sAns) === stripPrefix(cAns)) {
      return true;
    }
  }

  return false;
}
