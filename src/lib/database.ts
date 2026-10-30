import { api } from './apiClient';

// Database interfaces
export interface Profile {
  id: string;
  email: string;
  name: string;
  index_number?: string;
  role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department?: string;
  assigned_lecturer_id?: string | null;
  assigned_lecturer_name?: string;
  assigned_lecturer_email?: string;
  created_at: string;
  updated_at: string;
  question_count?: number;
  active_question_count?: number;
  quiz_count?: number;
}

export interface AssessmentCategoryItem {
  id: string;
  course_id: string;
  name: string;
  prefix: string;
  color: string;
  description: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionBankItem {
  id: string;
  course_id: string;
  topic: string;
  category?: string;
  category_prefix?: string;
  assessment_tier?: AssessmentCategory;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'active' | 'retired' | 'draft';
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: any; // string[] or JSON array
  correct_answer: string;
  marks: number;
  times_answered: number;
  times_correct: number;
  empirical_pass_rate: number | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionBankAccessRequest {
  id: string;
  course_id: string;
  course_code?: string;
  course_title?: string;
  requester_id: string;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  reason: string;
  access_level: 'read_only' | 'contributor';
  duration_days: number;
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';
  reviewed_by?: string;
  reviewer_name?: string;
  reviewer_email?: string;
  reviewed_at?: string;
  expires_at?: string;
  review_notes?: string;
  granted_by?: string;
  granted_by_name?: string;
  revoked_by?: string;
  revoked_by_name?: string;
  revoked_at?: string;
  revocation_reason?: string;
  created_at: string;
}

export interface QuizSession {
  id: string;
  quiz_id: string;
  session_name: string;
  start_time: string;
  end_time: string;
  access_pin?: string;
  session_pool_index: number;
  created_at: string;
  student_count?: number;
}

export interface QuizSessionStudent {
  id: string;
  session_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  index_number?: string;
  created_at: string;
}

export interface QuizAttemptQuestion {
  id: string;
  attempt_id: string;
  question_bank_id?: string;
  question_id?: string;
  source_course_id?: string;
  blueprint_stratum_id?: string;
  order_index: number;
  created_at: string;
}

export type AssessmentCategory = 'final_exam' | 'mid_semester' | 'class_test' | 'quiz' | 'practice';

export interface TopicDrawRule {
  topic: string;
  count: number;
  marks_per_q?: number;
}

export interface BlueprintStratum {
  id: string;
  label?: string;
  course_id: string; // Specific course_id or 'any_selected'
  assessment_tiers?: AssessmentCategory[];
  category_prefixes?: string[];
  topics?: string[];
  difficulty?: 'any' | 'easy' | 'medium' | 'hard';
  count: number;
  marks_per_question?: number;
}

export interface ExamBlueprint {
  mode: 'flat_random' | 'stratified_matrix';
  total_draw_count: number;
  fallback_policy: 'top_up_pool' | 'strict' | 'allow_deficit';
  pool_course_ids: string[];
  strata: BlueprintStratum[];
}

export interface Quiz {
  id: string;
  lecturer_id: string;
  course_id?: string;
  title: string;
  description: string;
  subject: string;
  duration_minutes: number;
  total_marks: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'published' | 'archived';
  category?: AssessmentCategory;
  deadline?: string;
  moderator_id?: string;
  admin_id?: string;
  reviewed_at?: string;
  published_at?: string;
  randomize_questions?: boolean;
  randomize_options?: boolean;
  show_results_immediately?: boolean;
  allow_review?: boolean;
  require_seb?: boolean;
  enable_camera_proctoring?: boolean;
  enable_screen_recording?: boolean;
  enable_tab_monitoring?: boolean;
  enable_copy_paste_prevention?: boolean;
  is_dynamic_draw?: boolean;
  draw_question_count?: number;
  topic_draw_rules?: TopicDrawRule[];
  has_multiple_sessions?: boolean;
  category_prefix?: string;
  bank_category_filter?: string;
  pool_course_ids?: string[];
  exam_blueprint?: ExamBlueprint;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  quiz_id: string | null;
  lecturer_id: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: any;
  correct_answer: string;
  marks: number;
  topic?: string;
  difficulty?: string;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  status: 'in_progress' | 'submitted' | 'graded';
  graded_at: string | null;
  tab_switches?: number;
  time_paused?: number;
  suspicious_activity?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  cheated?: boolean;
  cheating_reason?: string;
  tab_switch_count?: number;
  copy_attempts?: number;
  right_click_count?: number;
}

export interface StudentAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean | null;
  marks_obtained: number | null;
  lecturer_comment: string;
  is_flagged?: boolean;
  created_at: string;
}

export interface QuizModeration {
  id: string;
  quiz_id: string;
  moderator_id: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  reviewed_at: string;
  created_at: string;
  updated_at: string;
}

export interface ExamResultsTransmission {
  id: string;
  quiz_id: string;
  lecturer_id: string;
  academic_year: string;
  semester: string;
  status: 'submitted' | 'under_review' | 'verified' | 'revision_requested';
  submission_notes?: string;
  reviewer_id?: string;
  review_notes?: string;
  total_candidates: number;
  passed_candidates: number;
  failed_candidates: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  grade_counts?: {
    A?: number;
    B?: number;
    C?: number;
    D?: number;
    F?: number;
    [key: string]: number | undefined;
  };
  submitted_at: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
  quiz_title?: string;
  quiz_subject?: string;
  duration_minutes?: number;
  lecturer_name?: string;
  lecturer_email?: string;
  reviewer_name?: string;
}

// Client-side compatibility helpers
export async function testConnection(): Promise<boolean> {
  try {
    const res = await api.get<{ user: any }>('/api/auth/me', { skipAuthRedirect: true });
    return !!res;
  } catch {
    return false;
  }
}

// Client-side migrations are retired in favor of server CLI migrations (`npm run db:migrate`)
export async function runMigrations(): Promise<boolean> {
  return true;
}

/**
 * Transparent RPC proxy:
 * All calls db.<method>(...args) are routed to /api/db, authenticated by httpOnly cookie,
 * validated by role guards on the server, and executed safely away from client-side bundle.
 */
export const db: any = new Proxy(
  {},
  {
    get(_target, propKey: string | symbol) {
      if (typeof propKey === 'symbol' || propKey === 'then' || propKey === 'catch') {
        return undefined;
      }
      return async (...args: any[]) => {
        const res = await api.post<{ data: any }>('/api/db', {
          method: propKey,
          args,
        });
        return res?.data;
      };
    },
  }
);
