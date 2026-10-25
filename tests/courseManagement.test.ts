import { describe, it, expect } from 'vitest';
import { 
  parseCoursesCSV, 
  generateCourseCSVTemplate, 
  exportCoursesToCSVString,
  COURSE_CSV_HEADER
} from '../src/utils/courseCsvUtils';
import { Course } from '../src/lib/database';

describe('Course Management & CSV Utilities', () => {
  describe('generateCourseCSVTemplate', () => {
    it('generates official institutional template with header comments and sample rows', () => {
      const template = generateCourseCSVTemplate();
      expect(template).toContain('# Institutional Course Registry Import Template');
      expect(template).toContain(COURSE_CSV_HEADER);
      expect(template).toContain('CSC101');
      expect(template).toContain('MTH201');
    });
  });

  describe('parseCoursesCSV', () => {
    it('returns error if content is empty or whitespace', () => {
      const res = parseCoursesCSV('');
      expect(res.success).toBe(false);
      expect(res.errors[0]).toContain('empty');
      expect(res.courses).toHaveLength(0);
    });

    it('parses valid CSV rows into course objects with uppercase codes', () => {
      const csv = `
# Comment line
Course Code,Course Title,Department,Assigned Lecturer Email
csc101,"Introduction to Programming",Computer Science,prof.john@university.edu
mth202,"Advanced Calculus",Mathematics,
      `.trim();

      const res = parseCoursesCSV(csv);
      expect(res.success).toBe(true);
      expect(res.courses).toHaveLength(2);
      expect(res.courses[0]).toEqual({
        code: 'CSC101',
        title: 'Introduction to Programming',
        department: 'Computer Science',
        assigned_lecturer_email: 'prof.john@university.edu'
      });
      expect(res.courses[1]).toEqual({
        code: 'MTH202',
        title: 'Advanced Calculus',
        department: 'Mathematics',
        assigned_lecturer_email: undefined
      });
    });

    it('reports errors for missing course code or title', () => {
      const csv = `
Course Code,Course Title,Department,Assigned Lecturer Email
,Missing Code Course,Computer Science,
CSC102,,Computer Science,
      `.trim();

      const res = parseCoursesCSV(csv);
      expect(res.success).toBe(false);
      expect(res.errors.length).toBeGreaterThanOrEqual(2);
      expect(res.errors[0]).toContain('Course Code is missing');
      expect(res.errors[1]).toContain('Course Title is missing');
    });

    it('detects duplicate course codes in the uploaded CSV', () => {
      const csv = `
Course Code,Course Title,Department,Assigned Lecturer Email
CSC101,First CS Course,Computer Science,
CSC101,Duplicate CS Course,Computer Science,
      `.trim();

      const res = parseCoursesCSV(csv);
      expect(res.success).toBe(false);
      expect(res.errors.some(e => e.includes('Duplicate course code'))).toBe(true);
    });
  });

  describe('exportCoursesToCSVString', () => {
    it('exports courses with RFC 4180 escaping and headers', () => {
      const mockCourses: Course[] = [
        {
          id: 'c1',
          code: 'CSC101',
          title: 'Intro to CS, Algorithms & Data',
          department: 'Engineering',
          assigned_lecturer_email: 'lead@univ.edu',
          created_at: '2026-01-01',
          updated_at: '2026-01-01'
        },
        {
          id: 'c2',
          code: 'MTH101',
          title: 'Algebra',
          department: 'Math',
          created_at: '2026-01-01',
          updated_at: '2026-01-01'
        }
      ];

      const csv = exportCoursesToCSVString(mockCourses);
      expect(csv).toContain(COURSE_CSV_HEADER);
      expect(csv).toContain('CSC101,"Intro to CS, Algorithms & Data",Engineering,lead@univ.edu');
      expect(csv).toContain('MTH101,Algebra,Math,');
    });
  });
});
