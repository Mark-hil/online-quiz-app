import React, { useState } from 'react';
import { 
  Edit2, Trash2, Check, BarChart2, ChevronDown, ChevronUp, Archive, RefreshCw 
} from 'lucide-react';
import Button from '../../../../components/ui/Button';
import Badge from '../../../../components/ui/Badge';
import { QuestionBankItem, AssessmentCategoryItem } from '../../../../lib/database';
import { parseOptions } from '../../../../utils/quizUtils';
import { 
  getCategoryColorBadgeClasses, 
  getCategoryBadgeClasses, 
  getCategoryShortLabel 
} from '../../../../utils/categoryUtils';

interface QuestionBankCardProps {
  question: QuestionBankItem;
  index: number;
  isSelected: boolean;
  courseCategories: AssessmentCategoryItem[];
  onToggleSelect: (id: string) => void;
  onEdit: (question: QuestionBankItem) => void;
  onToggleStatus: (question: QuestionBankItem) => void;
  onDelete: (id: string) => void;
}

export default function QuestionBankCard({
  question: q,
  index,
  isSelected,
  courseCategories,
  onToggleSelect,
  onEdit,
  onToggleStatus,
  onDelete,
}: QuestionBankCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const parsedOptions: string[] = parseOptions(q.options);
  const answeredCount = q.times_answered || 0;
  const correctCount = q.times_correct || 0;
  const isCalibrated = answeredCount >= 5;

  const categoryItem = courseCategories.find(c => c.prefix === q.category_prefix);

  return (
    <div
      className={`bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${
        isSelected
          ? 'border-blue-400 bg-blue-50/20 ring-2 ring-blue-400/30'
          : q.status === 'retired'
            ? 'border-slate-200 bg-slate-50/50 opacity-80'
            : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        {/* Left: Badges, Question Text & Options */}
        <div className="space-y-3 flex-1 min-w-0">
          {/* Metadata Badges Header */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(q.id)}
              className="rounded text-blue-600 focus:ring-blue-500/20 w-4 h-4 cursor-pointer mr-1"
              title="Select question"
            />

            <span className="font-mono font-bold text-slate-400">
              #{index}
            </span>

            {/* Topic Badge */}
            <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 font-semibold py-0.5 px-2">
              {q.topic || 'General'}
            </Badge>

            {/* Assessment Category & Prefix Badge */}
            {(q.category_prefix || (q.category && q.category !== 'General')) && (
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                  getCategoryColorBadgeClasses(categoryItem?.color)
                }`}
              >
                [{q.category_prefix || q.category}] {q.category && q.category !== q.category_prefix ? q.category : ''}
              </span>
            )}

            {/* Assessment Classification Tier Badge */}
            <span className={`px-2 py-0.5 rounded-md text-xs border font-medium ${getCategoryBadgeClasses(q.assessment_tier || 'quiz')}`}>
              {getCategoryShortLabel(q.assessment_tier || 'quiz')}
            </span>

            {/* Empirical Difficulty Badge */}
            {q.difficulty === 'easy' && (
              <Badge variant="success" className="bg-teal-50 text-teal-700 border-teal-200 py-0.5 font-semibold">
                🟢 Easy {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
              </Badge>
            )}
            {q.difficulty === 'medium' && (
              <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200 py-0.5 font-semibold">
                🟡 Medium {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
              </Badge>
            )}
            {q.difficulty === 'hard' && (
              <Badge variant="danger" className="bg-rose-50 text-rose-700 border-rose-200 py-0.5 font-semibold">
                🔴 Hard {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
              </Badge>
            )}

            {/* Status Badge */}
            {q.status === 'active' ? (
              <Badge variant="success" className="text-[11px] font-semibold py-0.5">Active Pool</Badge>
            ) : q.status === 'retired' ? (
              <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[11px] font-medium py-0.5">
                Archived
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[11px] font-medium py-0.5">
                Draft
              </Badge>
            )}

            {/* Marks Badge */}
            <span className="font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
              {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
            </span>

            {/* Type */}
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              {q.question_type.toUpperCase()}
            </span>
          </div>

          {/* Question Text */}
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-semibold text-slate-900 leading-snug break-words">
              {q.question_text}
            </p>
            {parsedOptions.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors shrink-0"
                title={isExpanded ? 'Collapse options' : 'Expand options'}
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>

          {/* MCQ Options Display (Collapsible) */}
          {isExpanded && q.question_type === 'mcq' && Array.isArray(parsedOptions) && parsedOptions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 animate-in fade-in duration-200">
              {parsedOptions.map((opt, optIdx) => {
                const letter = String.fromCharCode(65 + optIdx);
                const isCorrect = q.correct_answer === letter || q.correct_answer === opt;
                return (
                  <div
                    key={optIdx}
                    className={`text-xs p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                      isCorrect 
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium shadow-xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                        isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="flex-1 break-words leading-relaxed">{opt}</span>
                    {isCorrect && <Check size={14} className="text-emerald-600 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* True / False Display */}
          {isExpanded && q.question_type === 'true_false' && (
            <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 p-2.5 rounded-xl inline-flex items-center gap-2">
              <span>Correct Answer:</span>
              <strong className="text-emerald-700 font-bold uppercase bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {q.correct_answer}
              </strong>
            </div>
          )}

          {/* Answer Statistics Bar */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-50">
            <span className="flex items-center gap-1.5 font-medium">
              <BarChart2 size={13} className="text-slate-400" />
              {isCalibrated ? (
                <span>
                  Pass rate: <strong className="text-slate-800">{q.empirical_pass_rate}%</strong> ({correctCount} of {answeredCount} correct attempts)
                </span>
              ) : (
                <span className="text-slate-400 italic">
                  Calibrating pass rate ({answeredCount}/5 test responses)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Right: Actions Menu */}
        <div className="flex lg:flex-col items-center gap-2 justify-end pt-2 lg:pt-0 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(q)}
            className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl border-slate-200 text-slate-700 hover:text-blue-600 hover:bg-slate-50"
          >
            <Edit2 size={13} />
            <span>Edit</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onToggleStatus(q)}
            className={`text-xs py-1.5 px-3 rounded-xl border-slate-200 transition-colors ${
              q.status === 'active' 
                ? 'text-slate-600 hover:text-amber-700 hover:bg-amber-50' 
                : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            {q.status === 'active' ? (
              <span className="flex items-center gap-1">
                <Archive size={12} /> Retire
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <RefreshCw size={12} /> Activate
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(q.id)}
            className="text-rose-600 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-xs py-1.5 px-2.5 rounded-xl transition-all"
            title="Delete question"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
