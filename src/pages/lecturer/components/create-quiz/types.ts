import { Course, AssessmentCategory, TopicDrawRule, AssessmentCategoryItem, Quiz } from '../../../lib/database';

export type WizardStep = 1 | 2 | 3 | 4;

export interface QuestionForm {
  id?: string;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: string[];
  correct_answer: string;
  marks: number;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  category_prefix?: string;
}

export interface QuizFormData {
  // Step 1: Basics
  course_id: string;
  title: string;
  category: AssessmentCategory;
  category_prefix: string;
  subject: string;
  description: string;
  duration: string;
  deadlineDate: string;
  deadlineTime: string;
  deadline: string;

  // Step 2: Questions & Bank Strategy
  isDynamicDraw: boolean;
  poolMode: 'flat' | 'stratified';
  poolCourseIds: string[];
  selectedPoolCategories: string[];
  selectedPoolTiers: AssessmentCategory[];
  topicRules: Record<string, number>;
  drawQuestionCount: string;
  saveToQuestionBank: boolean;
  questions: QuestionForm[];

  // Step 3: Security & Proctoring
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  passingScore: string;
  enableScreenRecording: boolean;
  enableTabMonitoring: boolean;
  enableCopyPastePrevention: boolean;
  showResultsImmediately: boolean;

  // Multiple Sessions
  hasMultipleSessions: boolean;
}

export interface ValidationItem {
  key: string;
  label: string;
  step: WizardStep;
  fieldId: string;
  isValid: boolean;
  message?: string;
}
