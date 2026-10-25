import { AssessmentCategory, TopicDrawRule } from '../lib/database';

export interface AssessmentCategoryMeta {
  key: AssessmentCategory;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeClasses: string;
  accentColor: string;
  iconName: string;
}

export const ASSESSMENT_CATEGORIES: AssessmentCategoryMeta[] = [
  {
    key: 'final_exam',
    label: 'Final Examination',
    shortLabel: 'Final Exam',
    description: 'Comprehensive summative examination assessing full semester learning outcomes.',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    badgeClasses: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold',
    accentColor: 'purple',
    iconName: 'GraduationCap',
  },
  {
    key: 'mid_semester',
    label: 'Mid-Semester Exam',
    shortLabel: 'Mid-Semester',
    description: 'Formal midterm assessment evaluating student progress across initial modules.',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-200',
    badgeClasses: 'bg-blue-50 text-blue-700 border-blue-200 font-semibold',
    accentColor: 'blue',
    iconName: 'FileText',
  },
  {
    key: 'class_test',
    label: 'Class Test',
    shortLabel: 'Class Test',
    description: 'Periodic continuous assessment targeting 1–2 specific module topics.',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    badgeClasses: 'bg-amber-50 text-amber-800 border-amber-200 font-semibold',
    accentColor: 'amber',
    iconName: 'CheckSquare',
  },
  {
    key: 'quiz',
    label: 'Class Quiz',
    shortLabel: 'Quiz',
    description: 'Short review assessment or pop quiz for rapid comprehension checks.',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-200',
    badgeClasses: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    accentColor: 'emerald',
    iconName: 'Zap',
  },
  {
    key: 'practice',
    label: 'Practice / Mock',
    shortLabel: 'Practice',
    description: 'Ungraded or preparatory trial exam for revision and familiarization.',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
    badgeClasses: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold',
    accentColor: 'slate',
    iconName: 'HelpCircle',
  },
];

export const CATEGORY_MAP: Record<AssessmentCategory, AssessmentCategoryMeta> =
  ASSESSMENT_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = cat;
    return acc;
  }, {} as Record<AssessmentCategory, AssessmentCategoryMeta>);

export function getCategoryMeta(category?: string | null): AssessmentCategoryMeta {
  if (!category) return CATEGORY_MAP.quiz;
  return CATEGORY_MAP[category as AssessmentCategory] || CATEGORY_MAP.quiz;
}

export function getCategoryLabel(category?: string | null): string {
  return getCategoryMeta(category).label;
}

export function getCategoryShortLabel(category?: string | null): string {
  return getCategoryMeta(category).shortLabel;
}

export function getCategoryBadgeClasses(category?: string | null): string {
  return getCategoryMeta(category).badgeClasses;
}

/**
 * Formats a list of TopicDrawRule into a human-readable summary
 * e.g. "25 questions: Calculus (10), Linear Algebra (10), Probability (5)"
 */
export function formatTopicDrawSummary(
  rules?: TopicDrawRule[] | null,
  drawCount?: number
): string {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return drawCount ? `Draw ${drawCount} items from Course Bank` : 'Uniform Course Bank Draw';
  }

  const activeRules = rules.filter(r => Number(r.count) > 0);
  if (activeRules.length === 0) {
    return drawCount ? `Draw ${drawCount} items from Course Bank` : 'Uniform Course Bank Draw';
  }

  const total = activeRules.reduce((sum, r) => sum + Number(r.count), 0);
  const parts = activeRules.map(r => `${r.topic} (${r.count})`).join(', ');
  return `${total} items: ${parts}`;
}

/**
 * Parses raw topic_draw_rules from JSON string or array safely
 */
export function parseTopicDrawRules(raw: any): TopicDrawRule[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

export interface DefaultCategoryPreset {
  name: string;
  prefix: string;
  color: string;
  description: string;
}

export const DEFAULT_CATEGORY_PRESETS: DefaultCategoryPreset[] = [
  { name: 'Final Examination', prefix: 'FE', color: 'purple', description: 'Comprehensive summative final examination' },
  { name: 'Mid-Semester Exam', prefix: 'MID', color: 'blue', description: 'Midterm progress assessment' },
  { name: 'Class Test', prefix: 'CT', color: 'amber', description: 'Periodic continuous assessment test' },
  { name: 'Class Quiz', prefix: 'QZ', color: 'emerald', description: 'Quick review quiz or comprehension check' },
  { name: 'Practice / Mock', prefix: 'PRAC', color: 'slate', description: 'Ungraded revision or practice drill' },
];

export function getCategoryColorBadgeClasses(color?: string): string {
  switch (color?.toLowerCase()) {
    case 'purple':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'blue':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'amber':
    case 'yellow':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'emerald':
    case 'green':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'rose':
    case 'red':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'cyan':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    case 'indigo':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export function formatCategoryWithPrefix(name?: string, prefix?: string | null): string {
  if (!name && !prefix) return 'General';
  if (name && prefix) return `[${prefix}] ${name}`;
  if (prefix) return `[${prefix}]`;
  return name || 'General';
}

