import { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  BookOpen,
  Award,
  Layers,
  HelpCircle,
  Check,
  AlertCircle,
  Tag,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Quiz } from '../../lib/database';
import { parseOptions } from '../../utils/quizUtils';
import Button from '../ui/Button';

export interface QuizWithDetails extends Quiz {
  lecturer_name: string;
  lecturer_email: string;
}

interface QuizReviewModalProps {
  quiz: QuizWithDetails | null;
  questions: any[];
  questionsLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (notes: string) => Promise<void>;
  onReject: (notes: string) => Promise<void>;
}

const REVISION_PRESETS = [
  'Typo or wording in question text',
  'Incorrect answer key or options mismatch',
  'Ambiguous multiple choice options',
  'Marks allocation needs adjustment',
  'Missing diagram, context or explanation',
];

export default function QuizReviewModal({
  quiz,
  questions,
  questionsLoading,
  isOpen,
  onClose,
  onApprove,
  onReject,
}: QuizReviewModalProps) {
  const [notes, setNotes] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNotes('');
      setFilterType('all');
      setActiveQuestionIndex(null);
      setValidationError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, quiz]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !quiz) return null;

  const filteredQuestions = questions.filter(q => {
    if (filterType === 'all') return true;
    return q.question_type === filterType;
  });

  const mcqCount = questions.filter(q => q.question_type === 'mcq').length;
  const tfCount = questions.filter(q => q.question_type === 'true_false').length;
  const essayCount = questions.filter(q => q.question_type === 'essay' || !['mcq', 'true_false'].includes(q.question_type)).length;
  const totalCalculatedMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  const handlePresetClick = (preset: string) => {
    setValidationError(null);
    setNotes(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.includes(preset)) return trimmed;
      return `${trimmed}\n• ${preset}`;
    });
  };

  const handleApproveClick = async () => {
    try {
      setIsSubmitting(true);
      setValidationError(null);
      await onApprove(notes.trim());
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectClick = async () => {
    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
      setValidationError('Please provide revision notes or select a reason so the lecturer knows what to fix.');
      // Focus textarea
      const textarea = document.getElementById('moderator-notes-input');
      textarea?.focus();
      return;
    }

    try {
      setIsSubmitting(true);
      setValidationError(null);
      await onReject(trimmedNotes);
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToQuestion = (idx: number) => {
    setActiveQuestionIndex(idx);
    const element = document.getElementById(`review-question-${idx}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
      {/* Blurred Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm transition-opacity"
        onClick={() => !isSubmitting && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-5xl max-h-[94vh] bg-white rounded-2xl shadow-2xl border border-slate-200/80 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Sticky Executive Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between border-b border-slate-700/80 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 flex-shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold truncate text-white">
                  {quiz.title}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Pending Review
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                Submitted by <span className="text-slate-100 font-medium">{quiz.lecturer_name}</span> ({quiz.lecturer_email})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0 ml-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Close review modal (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50/50">

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">
                <BookOpen size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Subject / Course</p>
                <p className="text-sm font-bold text-slate-900 truncate">{quiz.subject || 'General'}</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Exam Duration</p>
                <p className="text-sm font-bold text-slate-900 truncate">{quiz.duration_minutes} Minutes</p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 font-bold">
                <HelpCircle size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Questions</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {questionsLoading ? '...' : `${questions.length} Items`}
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">
                <Award size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500 font-medium">Marks (Target/Sum)</p>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {quiz.total_marks} / {totalCalculatedMarks} pts
                </p>
              </div>
            </div>
          </div>

          {/* Description & Configuration Notes */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Exam Instructions & Overview</span>
              <div className="flex items-center gap-2 flex-wrap">
                {quiz.is_dynamic_draw && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full font-semibold border border-purple-200 flex items-center gap-1">
                    <Sparkles size={12} />
                    Dynamic Draw ({quiz.draw_question_count || 25} items/student)
                  </span>
                )}
                {quiz.has_multiple_sessions && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200 flex items-center gap-1">
                    <Layers size={12} />
                    Multi-Session Cohort
                  </span>
                )}
                {quiz.randomize_questions && (
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                    Shuffled Questions
                  </span>
                )}
                {quiz.randomize_options && (
                  <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                    Shuffled Options
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {quiz.description || 'No detailed instructions or description provided by the lecturer.'}
            </p>
          </div>

          {/* Questions Section */}
          <div className="space-y-3">
            {/* Questions Filter & Jump Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Filter:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                      filterType === 'all'
                        ? 'bg-white text-blue-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({questions.length})
                  </button>
                  {mcqCount > 0 && (
                    <button
                      onClick={() => setFilterType('mcq')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        filterType === 'mcq'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      MCQ ({mcqCount})
                    </button>
                  )}
                  {tfCount > 0 && (
                    <button
                      onClick={() => setFilterType('true_false')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        filterType === 'true_false'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      True/False ({tfCount})
                    </button>
                  )}
                  {essayCount > 0 && (
                    <button
                      onClick={() => setFilterType('essay')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        filterType === 'essay'
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Essay ({essayCount})
                    </button>
                  )}
                </div>
              </div>

              {/* Jump to question pills */}
              {questions.length > 0 && questions.length <= 30 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-slate-400 font-medium mr-1">Jump to:</span>
                  {questions.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToQuestion(idx)}
                      className={`w-6 h-6 rounded-md text-xs font-bold transition-all flex items-center justify-center ${
                        activeQuestionIndex === idx
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={`Jump to Question ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Questions List */}
            {questionsLoading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-3 border-blue-600 border-t-transparent mb-3" />
                <p className="text-sm font-medium text-slate-600">Loading quiz questions for review...</p>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center shadow-sm">
                <HelpCircle className="mx-auto text-slate-400 mb-2" size={36} />
                <p className="text-base font-semibold text-slate-700">No questions found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {filterType !== 'all' ? `No questions match the "${filterType}" filter.` : 'This quiz currently has 0 attached questions.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQuestions.map((q, idx) => {
                  const options = parseOptions(q.options);
                  const isMcq = q.question_type === 'mcq';
                  const isTf = q.question_type === 'true_false';
                  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

                  return (
                    <div
                      key={q.id || idx}
                      id={`review-question-${idx}`}
                      className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden hover:border-slate-300 transition-colors"
                    >
                      {/* Question Top Bar */}
                      <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
                            Q{idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                            {isMcq ? 'Multiple Choice' : isTf ? 'True / False' : 'Essay / Written'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            {q.marks || 1} {q.marks === 1 ? 'Mark' : 'Marks'}
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <div className="p-5 space-y-4">
                        <p className="text-base text-slate-900 font-medium leading-relaxed">
                          {q.question_text}
                        </p>

                        {/* Options Section */}
                        {(isMcq || isTf) && Array.isArray(options) && options.length > 0 && (
                          <div className="space-y-2 pt-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Options & Answer Key
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {options.map((opt: string, optIdx: number) => {
                                const isCorrect = String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
                                const letter = optionLetters[optIdx] || `${optIdx + 1}`;

                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                                      isCorrect
                                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium shadow-xs'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <span
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                          isCorrect
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span className="truncate">{opt}</span>
                                    </div>

                                    {isCorrect && (
                                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md flex-shrink-0">
                                        <Check size={14} className="stroke-[3]" />
                                        Correct Key
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Non-MCQ Answer Key summary */}
                        {(!isMcq && !isTf) && (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                            <span className="font-semibold text-slate-700 mr-2">Sample / Key Answer:</span>
                            <span className="text-emerald-700 font-medium">{q.correct_answer || 'Manual grading criteria'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Revision / Feedback Console */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label htmlFor="moderator-notes-input" className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-600" />
                Moderation Notes & Revision Feedback
                <span className="text-xs font-normal text-slate-500">(Required if requesting revisions / rejecting)</span>
              </label>
              <span className="text-xs text-slate-400">Notes are visible to the lecturer upon decision</span>
            </div>

            {/* Quick preset chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 font-medium mr-1 flex items-center gap-1">
                <Tag size={12} />
                Quick Presets:
              </span>
              {REVISION_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-slate-600 rounded-lg border border-slate-200 transition-colors font-medium cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              id="moderator-notes-input"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (validationError) setValidationError(null);
              }}
              rows={3}
              placeholder="e.g. Please verify the correct option for Question 3 and fix the typo in Question 5..."
              className={`w-full p-3.5 text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 ${
                validationError
                  ? 'border-red-300 focus:ring-red-400 bg-red-50/20'
                  : 'border-slate-300 focus:ring-blue-500 focus:border-blue-500 bg-white'
              }`}
            />

            {validationError && (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-in fade-in">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Sticky Footer Action Bar */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-slate-500">
            {notes.trim().length > 0 ? (
              <span className="text-blue-600 font-medium">Feedback notes recorded ({notes.trim().length} chars)</span>
            ) : (
              <span>Ready for decision</span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm"
            >
              Cancel
            </Button>

            <Button
              variant="danger"
              onClick={handleRejectClick}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-semibold flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white shadow-sm"
            >
              <XCircle size={16} />
              {isSubmitting ? 'Processing...' : 'Request Changes / Reject'}
            </Button>

            <Button
              variant="primary"
              onClick={handleApproveClick}
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <CheckCircle size={16} />
              {isSubmitting ? 'Approving...' : 'Approve Quiz'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
