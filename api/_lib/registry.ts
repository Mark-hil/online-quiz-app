import type { SessionUser, Role } from './types.js';
import { sql } from './db.js';
import * as users from './queries/users.js';
import * as courses from './queries/courses.js';
import * as questionBank from './queries/questionBank.js';
import * as sessions from './queries/sessions.js';
import * as quizzes from './queries/quizzes.js';
import * as attempts from './queries/attempts.js';
import * as extensions from './queries/extensions.js';
import * as transmissions from './queries/transmissions.js';
import * as audit from './queries/audit.js';
import * as analytics from './queries/analytics.js';

export interface MethodDefinition {
  handler: (...args: any[]) => Promise<any>;
  allowedRoles?: Role[];
  guard?: (user: SessionUser, args: any[]) => Promise<any[] | void> | any[] | void;
  transformResult?: (user: SessionUser, result: any) => Promise<any> | any;
}

const ALL_ROLES: Role[] = ['student', 'lecturer', 'moderator', 'admin', 'super_admin'];
const STAFF_ROLES: Role[] = ['lecturer', 'moderator', 'admin', 'super_admin'];
const ADMIN_ROLES: Role[] = ['moderator', 'admin', 'super_admin'];
const SUPER_ADMIN_ONLY: Role[] = ['super_admin'];

async function assertAttemptOwner(attemptId: string, studentId: string) {
  if (!attemptId) return;
  const rows = await sql`SELECT student_id FROM quiz_attempts WHERE id = ${attemptId}`;
  if (rows.length === 0 || rows[0].student_id !== studentId) {
    throw new Error('Access denied: Quiz attempt does not belong to you');
  }
}

export const registry: Record<string, MethodDefinition> = {
  // ─── Users & Profiles ──────────────────────────────────────────────────
  getProfile: {
    handler: users.getProfile,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      if (!args[0]) args[0] = user.id;
    },
  },
  getProfiles: {
    handler: users.getProfiles,
    allowedRoles: ALL_ROLES,
  },
  getProfilesByIds: {
    handler: users.getProfilesByIds,
    allowedRoles: ALL_ROLES,
  },
  getUsersByRole: {
    handler: users.getUsersByRole,
    allowedRoles: ADMIN_ROLES,
  },
  getAllUsers: {
    handler: users.getAllUsers,
    allowedRoles: ADMIN_ROLES,
  },
  updateUserRole: {
    handler: users.updateUserRole,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  deleteUser: {
    handler: users.deleteUser,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  createProfile: {
    handler: users.createProfile,
    allowedRoles: SUPER_ADMIN_ONLY,
  },

  // ─── Courses ───────────────────────────────────────────────────────────
  getCourses: {
    handler: courses.getCourses,
    allowedRoles: STAFF_ROLES,
  },
  getCourse: {
    handler: courses.getCourse,
    allowedRoles: STAFF_ROLES,
  },
  createCourse: {
    handler: courses.createCourse,
    allowedRoles: STAFF_ROLES,
  },
  updateCourse: {
    handler: courses.updateCourse,
    allowedRoles: STAFF_ROLES,
  },
  assignCourseLecturer: {
    handler: courses.assignCourseLecturer,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      // If lecturer, they can only claim or assign themselves
      if (user.role === 'lecturer') {
        args[1] = user.id;
      }
    },
  },
  checkUserCourseAccess: {
    handler: courses.checkUserCourseAccess,
    allowedRoles: STAFF_ROLES,
  },
  requestBankAccess: {
    handler: questionBank.requestBankAccess,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (args[0] && typeof args[0] === 'object') {
        args[0].lecturer_id = user.id;
      }
    },
  },
  getBankAccessRequests: {
    handler: questionBank.getBankAccessRequests,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer') {
        args[0] = { ...(args[0] || {}), lecturer_id: user.id };
      }
    },
  },
  reviewBankAccessRequest: {
    handler: questionBank.reviewBankAccessRequest,
    allowedRoles: ADMIN_ROLES,
    guard: (user, args) => {
      args[1] = user.id; // reviewerId
    },
  },

  // ─── Question Bank ─────────────────────────────────────────────────────
  getQuestionBankQuestions: {
    handler: questionBank.getQuestionBankQuestions,
    allowedRoles: STAFF_ROLES,
  },
  getQuestionBankItem: {
    handler: questionBank.getQuestionBankItem,
    allowedRoles: STAFF_ROLES,
  },
  createQuestionBankItem: {
    handler: questionBank.createQuestionBankItem,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (args[0] && typeof args[0] === 'object') {
        args[0].created_by = user.id;
      }
    },
  },
  updateQuestionBankItem: {
    handler: questionBank.updateQuestionBankItem,
    allowedRoles: STAFF_ROLES,
  },
  deleteQuestionBankItem: {
    handler: questionBank.deleteQuestionBankItem,
    allowedRoles: STAFF_ROLES,
  },
  bulkInsertQuestionBank: {
    handler: questionBank.bulkInsertQuestionBank,
    allowedRoles: STAFF_ROLES,
  },
  syncQuizQuestionsToBank: {
    handler: questionBank.syncQuizQuestionsToBank,
    allowedRoles: STAFF_ROLES,
  },
  retirePreviousTermQuestions: {
    handler: questionBank.retirePreviousTermQuestions,
    allowedRoles: STAFF_ROLES,
  },
  getQuestionBankStats: {
    handler: questionBank.getQuestionBankStats,
    allowedRoles: STAFF_ROLES,
  },
  recordQuestionAnswerResult: {
    handler: questionBank.recordQuestionAnswerResult,
    allowedRoles: ALL_ROLES,
  },

  // ─── Quiz Sessions ─────────────────────────────────────────────────────
  getQuizSessions: {
    handler: sessions.getQuizSessions,
    allowedRoles: STAFF_ROLES,
  },
  createQuizSession: {
    handler: sessions.createQuizSession,
    allowedRoles: STAFF_ROLES,
  },
  updateQuizSession: {
    handler: sessions.updateQuizSession,
    allowedRoles: STAFF_ROLES,
  },
  deleteQuizSession: {
    handler: sessions.deleteQuizSession,
    allowedRoles: STAFF_ROLES,
  },
  getQuizSessionStudents: {
    handler: sessions.getQuizSessionStudents,
    allowedRoles: STAFF_ROLES,
  },
  assignStudentsToSession: {
    handler: sessions.assignStudentsToSession,
    allowedRoles: STAFF_ROLES,
  },
  removeStudentFromSession: {
    handler: sessions.removeStudentFromSession,
    allowedRoles: STAFF_ROLES,
  },
  getStudentAssignedSession: {
    handler: sessions.getStudentAssignedSession,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      if (user.role === 'student') {
        args[1] = user.id;
      }
    },
  },

  // ─── Quizzes ───────────────────────────────────────────────────────────
  getQuizzes: {
    handler: quizzes.getQuizzes,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      if (user.role === 'student') {
        args[0] = undefined; // Force student to only receive published quizzes
      }
    },
  },
  getQuiz: {
    handler: quizzes.getQuiz,
    allowedRoles: ALL_ROLES,
    transformResult: (user, quiz) => {
      if (!quiz) return null;
      if (user.role === 'student' && quiz.status !== 'published') {
        throw new Error('Access denied: Quiz is not published');
      }
      return quiz;
    },
  },
  createQuiz: {
    handler: quizzes.createQuiz,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer' && args[0]) {
        args[0].lecturer_id = user.id;
      }
    },
  },
  updateQuiz: {
    handler: quizzes.updateQuiz,
    allowedRoles: STAFF_ROLES,
  },
  deleteQuiz: {
    handler: quizzes.deleteQuiz,
    allowedRoles: STAFF_ROLES,
  },
  submitForApproval: {
    handler: quizzes.submitForApproval,
    allowedRoles: STAFF_ROLES,
  },
  getPendingQuizzes: {
    handler: quizzes.getPendingQuizzes,
    allowedRoles: ADMIN_ROLES,
  },
  getApprovedQuizzes: {
    handler: quizzes.getApprovedQuizzes,
    allowedRoles: ADMIN_ROLES,
  },
  getAllQuizzesDebug: {
    handler: quizzes.getAllQuizzesDebug,
    allowedRoles: ADMIN_ROLES,
  },
  fixQuizStatuses: {
    handler: quizzes.fixQuizStatuses,
    allowedRoles: ADMIN_ROLES,
  },
  moderateQuiz: {
    handler: quizzes.moderateQuiz,
    allowedRoles: ADMIN_ROLES,
    guard: (user, args) => {
      args[1] = user.id; // moderatorId
    },
  },
  getQuizModerations: {
    handler: quizzes.getQuizModerations,
    allowedRoles: STAFF_ROLES,
  },
  publishQuiz: {
    handler: quizzes.publishQuiz,
    allowedRoles: ADMIN_ROLES,
    guard: (user, args) => {
      args[1] = user.id; // adminId
    },
  },
  unpublishQuiz: {
    handler: quizzes.unpublishQuiz,
    allowedRoles: ADMIN_ROLES,
  },
  getPublishedQuizzes: {
    handler: quizzes.getPublishedQuizzes,
    allowedRoles: ALL_ROLES,
  },
  getArchivedQuizzes: {
    handler: quizzes.getArchivedQuizzes,
    allowedRoles: ADMIN_ROLES,
  },
  archiveQuizzes: {
    handler: quizzes.archiveQuizzes,
    allowedRoles: ADMIN_ROLES,
  },
  getQuestions: {
    handler: questionBank.getQuestions,
    allowedRoles: STAFF_ROLES,
  },
  createQuestion: {
    handler: questionBank.createQuestion,
    allowedRoles: STAFF_ROLES,
  },
  deleteQuestion: {
    handler: questionBank.deleteQuestion,
    allowedRoles: STAFF_ROLES,
  },

  // ─── Attempts & Answers ────────────────────────────────────────────────
  createQuizAttempt: {
    handler: attempts.createQuizAttempt,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      if (user.role === 'student' && args[0]) {
        args[0].student_id = user.id;
      }
    },
  },
  updateQuizAttempt: {
    handler: attempts.updateQuizAttempt,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student') {
        await assertAttemptOwner(args[0], user.id);
      }
    },
  },
  getQuizAttempts: {
    handler: attempts.getQuizAttempts,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      if (user.role === 'student') {
        args[1] = user.id;
      }
    },
  },
  getLecturerQuizAttempts: {
    handler: attempts.getLecturerQuizAttempts,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer') {
        args[0] = user.id;
      }
    },
  },
  createStudentAnswer: {
    handler: attempts.createStudentAnswer,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student' && args[0]) {
        await assertAttemptOwner(args[0].attempt_id, user.id);
      }
    },
  },
  upsertStudentAnswer: {
    handler: attempts.upsertStudentAnswer,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student' && args[0]) {
        await assertAttemptOwner(args[0].attempt_id, user.id);
      }
    },
  },
  updateStudentAnswer: {
    handler: attempts.updateStudentAnswer,
    allowedRoles: ALL_ROLES,
  },
  getStudentAnswers: {
    handler: attempts.getStudentAnswers,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student' && args[0]) {
        await assertAttemptOwner(args[0], user.id);
      }
    },
  },
  getFlaggedAnswersForAdmin: {
    handler: attempts.getFlaggedAnswersForAdmin,
    allowedRoles: ADMIN_ROLES,
  },
  getLecturerAnswersForAnalytics: {
    handler: attempts.getLecturerAnswersForAnalytics,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer') {
        args[0] = user.id;
      }
    },
  },
  saveAttemptQuestions: {
    handler: attempts.saveAttemptQuestions,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student') {
        await assertAttemptOwner(args[0], user.id);
      }
    },
  },
  getAttemptQuestions: {
    handler: attempts.getAttemptQuestions,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student') {
        await assertAttemptOwner(args[0], user.id);
      }
    },
    transformResult: (user, questions) => {
      if (!Array.isArray(questions)) return questions;
      if (user.role === 'student') {
        // Redact correct_answer for student
        return questions.map((q) => {
          const { correct_answer, ...sanitized } = q;
          return sanitized;
        });
      }
      return questions;
    },
  },

  // ─── Quiz Extensions ───────────────────────────────────────────────────
  getQuizAttemptsForExtension: {
    handler: extensions.getQuizAttemptsForExtension,
    allowedRoles: STAFF_ROLES,
  },
  extendQuizTime: {
    handler: extensions.extendQuizTime,
    allowedRoles: STAFF_ROLES,
  },
  getAttemptExtensionRequests: {
    handler: extensions.getAttemptExtensionRequests,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student') {
        await assertAttemptOwner(args[0], user.id);
      }
    },
  },
  createExtensionRequest: {
    handler: extensions.createExtensionRequest,
    allowedRoles: ALL_ROLES,
    guard: async (user, args) => {
      if (user.role === 'student') {
        await assertAttemptOwner(args[0], user.id);
        args[1] = user.id; // requestedBy
        args[4] = 'pending'; // status
      }
    },
  },
  getExtensionRequests: {
    handler: extensions.getExtensionRequests,
    allowedRoles: STAFF_ROLES,
  },
  updateExtensionRequestStatus: {
    handler: extensions.updateExtensionRequestStatus,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      args[2] = user.id; // processedBy
    },
  },

  // ─── Transmissions & Broadsheet ────────────────────────────────────────
  createExamTransmission: {
    handler: transmissions.createExamTransmission,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer' && args[0]) {
        args[0].lecturer_id = user.id;
      }
    },
  },
  getExamTransmissions: {
    handler: transmissions.getExamTransmissions,
    allowedRoles: ADMIN_ROLES,
  },
  getExamTransmissionsByLecturer: {
    handler: transmissions.getExamTransmissionsByLecturer,
    allowedRoles: STAFF_ROLES,
    guard: (user, args) => {
      if (user.role === 'lecturer') {
        args[0] = user.id;
      }
    },
  },
  getExamTransmissionByQuiz: {
    handler: transmissions.getExamTransmissionByQuiz,
    allowedRoles: STAFF_ROLES,
  },
  updateExamTransmissionStatus: {
    handler: transmissions.updateExamTransmissionStatus,
    allowedRoles: ADMIN_ROLES,
  },
  getDetailedQuizCandidatesForBroadsheet: {
    handler: attempts.getDetailedQuizCandidatesForBroadsheet,
    allowedRoles: STAFF_ROLES,
  },

  // ─── Audit, System Settings & Health ───────────────────────────────────
  createAuditLog: {
    handler: audit.createAuditLog,
    allowedRoles: ALL_ROLES,
    guard: (user, args) => {
      args[0] = user.id; // userId
    },
  },
  getAuditLogs: {
    handler: audit.getAuditLogs,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  getLoginAttempts: {
    handler: audit.getLoginAttempts,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  getFailedLoginAttempts: {
    handler: audit.getFailedLoginAttempts,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  getSystemSetting: {
    handler: audit.getSystemSetting,
    allowedRoles: ALL_ROLES,
  },
  setSystemSetting: {
    handler: audit.setSystemSetting,
    allowedRoles: SUPER_ADMIN_ONLY,
    guard: (user, args) => {
      args[3] = user.id; // updatedBy
    },
  },
  getAllSystemSettings: {
    handler: audit.getAllSystemSettings,
    allowedRoles: ADMIN_ROLES,
  },
  recordHealthMetric: {
    handler: audit.recordHealthMetric,
    allowedRoles: SUPER_ADMIN_ONLY,
  },
  getRecentHealthMetrics: {
    handler: audit.getRecentHealthMetrics,
    allowedRoles: SUPER_ADMIN_ONLY,
  },

  // ─── Analytics & Diagnostics ───────────────────────────────────────────
  getUserActivityStats: {
    handler: analytics.getUserActivityStats,
    allowedRoles: STAFF_ROLES,
  },
  getQuizStats: {
    handler: analytics.getQuizStats,
    allowedRoles: STAFF_ROLES,
  },
  getQuizAttemptStats: {
    handler: analytics.getQuizAttemptStats,
    allowedRoles: STAFF_ROLES,
  },
  getExecutiveAcademicStats: {
    handler: analytics.getExecutiveAcademicStats,
    allowedRoles: STAFF_ROLES,
  },
  getExecutiveItemDiagnostics: {
    handler: analytics.getExecutiveItemDiagnostics,
    allowedRoles: STAFF_ROLES,
  },
  getExecutiveSecurityStats: {
    handler: analytics.getExecutiveSecurityStats,
    allowedRoles: ADMIN_ROLES,
  },
  getExecutiveCohortStats: {
    handler: analytics.getExecutiveCohortStats,
    allowedRoles: STAFF_ROLES,
  },
  getSystemDataStats: {
    handler: analytics.getSystemDataStats,
    allowedRoles: ADMIN_ROLES,
  },
  purgeTestData: {
    handler: analytics.purgeTestData,
    allowedRoles: SUPER_ADMIN_ONLY,
    guard: (user, args) => {
      if (args[0] && typeof args[0] === 'object') {
        args[0].performedByUserId = user.id;
      }
    },
  },
};
