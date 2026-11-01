import { 
  Course, 
  QuestionBankItem, 
  QuestionBankAccessRequest, 
  AssessmentCategoryItem, 
  AssessmentCategory 
} from '../../../lib/database';

export interface BankStats {
  total: number;
  active: number;
  retired: number;
  draft: number;
  easy: number;
  medium: number;
  hard: number;
  calibratedCount: number;
  topics: string[];
  categoryCounts?: Record<string, { total: number; active: number }>;
}

export type StatusFilterType = 'all' | 'active' | 'retired' | 'draft';
export type DifficultyFilterType = 'all' | 'easy' | 'medium' | 'hard';
export type TierFilterType = 'all' | AssessmentCategory;

export interface BankFilterState {
  searchTerm: string;
  statusFilter: StatusFilterType;
  difficultyFilter: string;
  topicFilter: string;
  categoryFilter: string;
  tierFilter: TierFilterType;
  itemsPerPage: number;
  currentPage: number;
}
