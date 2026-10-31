import { describe, it, expect } from 'vitest';
import { registry } from '../api/_lib/registry.js';
import type { SessionUser } from '../api/_lib/types.js';

describe('RPC Registry & Permissions', () => {
  const studentUser: SessionUser = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'student@example.com',
    name: 'Test Student',
    role: 'student',
    index_number: 'STU12345',
  };

  const lecturerUser: SessionUser = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'lecturer@example.com',
    name: 'Test Lecturer',
    role: 'lecturer',
  };

  const adminUser: SessionUser = {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'admin@example.com',
    name: 'Test Admin',
    role: 'admin',
  };

  it('restricts purgeTestData strictly to super_admin', () => {
    const entry = registry.purgeTestData;
    expect(entry).toBeDefined();
    expect(entry.allowedRoles).toEqual(['super_admin']);
    expect(entry.allowedRoles?.includes(studentUser.role)).toBe(false);
    expect(entry.allowedRoles?.includes(lecturerUser.role)).toBe(false);
    expect(entry.allowedRoles?.includes(adminUser.role)).toBe(false);
  });

  it('restricts course creation to staff roles (forbids student, allows lecturer and admin)', () => {
    const entry = registry.createCourse;
    expect(entry).toBeDefined();
    expect(entry.allowedRoles?.includes('student')).toBe(false);
    expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
    expect(entry.allowedRoles?.includes('admin')).toBe(true);
    expect(entry.allowedRoles?.includes('super_admin')).toBe(true);
  });

  it('allows lecturers and staff to view quiz moderations but forbids students', () => {
    const entry = registry.getQuizModerations;
    expect(entry).toBeDefined();
    expect(entry.allowedRoles?.includes('student')).toBe(false);
    expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
    expect(entry.allowedRoles?.includes('moderator')).toBe(true);
    expect(entry.allowedRoles?.includes('admin')).toBe(true);
  });

  it('enforces student quiz queries only return published quizzes', async () => {
    const entry = registry.getQuizzes;
    expect(entry).toBeDefined();
    const args = ['some-lecturer-id'];
    await entry.guard?.(studentUser, args);
    // Student guard must strip lecturerId filter so only published quizzes query runs
    expect(args[0]).toBeUndefined();
  });

  it('enforces student attempt queries only query the student own ID', async () => {
    const entry = registry.getQuizAttempts;
    expect(entry).toBeDefined();
    const args = ['quiz-id-123', 'other-student-id'];
    await entry.guard?.(studentUser, args);
    // Student guard must force args[1] (studentId) to studentUser.id
    expect(args[1]).toBe(studentUser.id);
  });

  it('redacts correct_answer for students in getAttemptQuestions transformResult', () => {
    const entry = registry.getAttemptQuestions;
    expect(entry).toBeDefined();
    expect(entry.transformResult).toBeDefined();

    const mockQuestions = [
      {
        id: 'q-1',
        question_text: 'What is 2+2?',
        options: ['1', '2', '3', '4'],
        correct_answer: '4',
        marks: 2,
      },
      {
        id: 'q-2',
        question_text: 'Is the sky blue?',
        options: ['True', 'False'],
        correct_answer: 'True',
        marks: 1,
      },
    ];

    const studentSanitized = entry.transformResult!(studentUser, mockQuestions);
    expect(studentSanitized[0].correct_answer).toBeUndefined();
    expect(studentSanitized[1].correct_answer).toBeUndefined();
    expect(studentSanitized[0].question_text).toBe('What is 2+2?');

    const lecturerView = entry.transformResult!(lecturerUser, mockQuestions);
    expect(lecturerView[0].correct_answer).toBe('4');
    expect(lecturerView[1].correct_answer).toBe('True');
  });

  it('allows students to query quiz sessions for multi-session and cohort gatekeeper quizzes', () => {
    const entry = registry.getQuizSessions;
    expect(entry).toBeDefined();
    expect(entry.allowedRoles?.includes('student')).toBe(true);
    expect(entry.allowedRoles?.includes('lecturer')).toBe(true);
    expect(entry.allowedRoles?.includes('admin')).toBe(true);
  });

  it('enforces student guard on assignStudentsToSession and removeStudentFromSession', async () => {
    const assignEntry = registry.assignStudentsToSession;
    expect(assignEntry.allowedRoles?.includes('student')).toBe(true);
    const assignArgs = ['session-1', ['other-student-id', 'someone-else']];
    await assignEntry.guard?.(studentUser, assignArgs);
    expect(assignArgs[1]).toEqual([studentUser.id]);

    const removeEntry = registry.removeStudentFromSession;
    expect(removeEntry.allowedRoles?.includes('student')).toBe(true);
    const removeArgs = ['session-1', 'other-student-id'];
    await removeEntry.guard?.(studentUser, removeArgs);
    expect(removeArgs[1]).toBe(studentUser.id);
  });

  it('allows students to fetch questions and question bank questions for active quizzes', () => {
    expect(registry.getQuestions.allowedRoles?.includes('student')).toBe(true);
    expect(registry.getQuestionBankQuestions.allowedRoles?.includes('student')).toBe(true);
  });
});

