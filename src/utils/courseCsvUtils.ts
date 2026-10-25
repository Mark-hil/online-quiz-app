/**
 * Course CSV Import / Export Utilities
 * 
 * Standardized 4-column format:
 * Course Code,Course Title,Department,Assigned Lecturer Email
 */

export interface ParsedCourseRow {
  code: string;
  title: string;
  department: string;
  assigned_lecturer_email?: string;
}

export interface CourseCSVParseResult {
  success: boolean;
  courses: ParsedCourseRow[];
  errors: string[];
  totalRows: number;
}

export const COURSE_CSV_HEADER = 'Course Code,Course Title,Department,Assigned Lecturer Email';

export const COURSE_CSV_SAMPLE_ROWS = [
  'CSC101,"Introduction to Computer Science",Computer Science,lecturer@university.edu',
  'MTH201,"Linear Algebra & Calculus",Mathematics,math.lead@university.edu',
  'ENG102,"Engineering Mechanics",Engineering,',
  'BUS301,"Business Ethics & Governance",Business Administration,business.coord@university.edu'
];

/**
 * Escapes a cell value for RFC 4180 CSV compliance
 */
export function escapeCSVCell(value: any): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates the official course catalog template content
 */
export function generateCourseCSVTemplate(): string {
  const lines = [
    '# Institutional Course Registry Import Template',
    '# Instructions: Course Code and Course Title are required. Assigned Lecturer Email is optional.',
    '# If the lecturer email exists in the system, the course will be automatically assigned to them.',
    COURSE_CSV_HEADER,
    ...COURSE_CSV_SAMPLE_ROWS
  ];
  return lines.join('\n');
}

/**
 * Low-level RFC 4180 CSV tokenizer supporting quotes, newlines in quotes, and escaped quotes
 */
export function tokenizeCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // Skip escaped double quote
        } else {
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // Handle CRLF or standalone CR
        if (nextChar === '\n') {
          i++;
        }
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // Push last remaining cell and row if not empty
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Parses raw CSV string into validated ParsedCourseRow items
 */
export function parseCoursesCSV(csvContent: string): CourseCSVParseResult {
  const errors: string[] = [];
  const courses: ParsedCourseRow[] = [];
  const seenCodes = new Set<string>();

  if (!csvContent || !csvContent.trim()) {
    return {
      success: false,
      courses: [],
      errors: ['The uploaded file is empty.'],
      totalRows: 0
    };
  }

  const rawRows = tokenizeCSV(csvContent);
  let totalDataRows = 0;

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || (row.length === 1 && !row[0])) {
      continue; // Skip empty line
    }

    const firstCell = row[0]?.trim();
    if (firstCell.startsWith('#')) {
      continue; // Skip comment lines
    }

    // Check if this is the header row
    const normalizedFirstCell = firstCell.toLowerCase().replace(/[\s_]/g, '');
    if (normalizedFirstCell === 'coursecode' || normalizedFirstCell === 'code') {
      continue;
    }

    totalDataRows++;
    const rowNumber = i + 1;

    const code = (row[0] || '').trim().toUpperCase();
    const title = (row[1] || '').trim();
    const department = (row[2] || '').trim();
    const lecturerEmail = (row[3] || '').trim();

    if (!code) {
      errors.push(`Row ${rowNumber}: Course Code is missing.`);
      continue;
    }

    if (!title) {
      errors.push(`Row ${rowNumber} (${code}): Course Title is missing.`);
      continue;
    }

    if (seenCodes.has(code)) {
      errors.push(`Row ${rowNumber}: Duplicate course code "${code}" detected in CSV.`);
      continue;
    }

    seenCodes.add(code);
    courses.push({
      code,
      title,
      department: department || 'General',
      assigned_lecturer_email: lecturerEmail || undefined
    });
  }

  return {
    success: errors.length === 0 && courses.length > 0,
    courses,
    errors,
    totalRows: totalDataRows
  };
}

/**
 * Exports a list of course items into a clean CSV string
 */
export function exportCoursesToCSVString(courses: any[]): string {
  const lines: string[] = [
    `# Institutional Course Registry Export`,
    `# Exported: ${new Date().toISOString()}`,
    COURSE_CSV_HEADER
  ];

  for (const c of courses) {
    const code = escapeCSVCell(c.code || '');
    const title = escapeCSVCell(c.title || '');
    const dept = escapeCSVCell(c.department || '');
    const email = escapeCSVCell(c.assigned_lecturer_email || '');
    lines.push(`${code},${title},${dept},${email}`);
  }

  return lines.join('\n');
}

/**
 * Helper to download CSV string in the browser
 */
export function downloadCSVFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
