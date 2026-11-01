import React from 'react';
import { 
  Shuffle, Layers, BookOpen, Upload, Download, Plus, 
  Trash2, Edit2, AlertCircle, CheckCircle2, FileText, 
  FileSpreadsheet, FileCode, ArrowLeft, ArrowRight, Tag, Users 
} from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import Badge from '../../../../components/ui/Badge';
import { Course, AssessmentCategory, AssessmentCategoryItem } from '../../../../lib/database';
import { parseOptions, isOptionMatch, formatDisplayCorrectAnswer } from '../../../../utils/quizUtils';
import { QuestionForm } from './types';
import { ASSESSMENT_CATEGORIES } from '../../../../utils/categoryUtils';

interface QuestionsStrategyStepProps {
  courseId: string;
  courses: Course[];
  selectedCourse?: Course;
  isDynamicDraw: boolean;
  onDynamicDrawChange: (val: boolean) => void;
  // Fixed Mode Props
  questions: QuestionForm[];
  onOpenAddQuestionModal: () => void;
  onEditQuestion: (index: number) => void;
  onDeleteQuestion: (index: number) => void;
  onOpenUploadModal: () => void;
  onOpenBankPickerModal: () => void;
  onDownloadTemplate: () => void;
  onExportCSV: () => void;
  saveToQuestionBank: boolean;
  onSaveToQuestionBankChange: (val: boolean) => void;
  // Dynamic Mode Props
  bankStats: any;
  poolCourseIds: string[];
  onPoolCourseIdsChange: (ids: string[]) => void;
  selectedPoolCategories: string[];
  onSelectedPoolCategoriesChange: (cats: string[]) => void;
  selectedPoolTiers: AssessmentCategory[];
  onSelectedPoolTiersChange: (tiers: AssessmentCategory[]) => void;
  drawQuestionCount: string;
  onDrawQuestionCountChange: (count: string) => void;
  topicRules: Record<string, number>;
  onTopicRulesChange: (rules: Record<string, number>) => void;
  activeQuestionsInPool: number;
  courseCategories: AssessmentCategoryItem[];
  hasMultipleSessions: boolean;
  onOpenSessionModal: () => void;
  // Navigation
  onBack: () => void;
  onNext: () => void;
}

export const QuestionsStrategyStep: React.FC<QuestionsStrategyStepProps> = ({
  courseId,
  courses,
  selectedCourse,
  isDynamicDraw,
  onDynamicDrawChange,
  questions,
  onOpenAddQuestionModal,
  onEditQuestion,
  onDeleteQuestion,
  onOpenUploadModal,
  onOpenBankPickerModal,
  onDownloadTemplate,
  onExportCSV,
  saveToQuestionBank,
  onSaveToQuestionBankChange,
  bankStats,
  poolCourseIds,
  onPoolCourseIdsChange,
  selectedPoolCategories,
  onSelectedPoolCategoriesChange,
  selectedPoolTiers,
  onSelectedPoolTiersChange,
  drawQuestionCount,
  onDrawQuestionCountChange,
  topicRules,
  onTopicRulesChange,
  activeQuestionsInPool,
  courseCategories,
  hasMultipleSessions,
  onOpenSessionModal,
  onBack,
  onNext,
}) => {
  const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Strategy Mode Switcher Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mode A: Fixed Question Set */}
        <button
          type="button"
          onClick={() => onDynamicDrawChange(false)}
          className={`p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
            !isDynamicDraw
              ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Layers size={22} />
              </div>
              {!isDynamicDraw ? (
                <span className="text-xs font-bold text-blue-700 bg-blue-100/90 border border-blue-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Active Mode
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Fixed Question Set (Standard Exam)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every candidate answers the exact same curated questions (with randomized question and option order).
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 text-xs text-slate-600 font-medium">
            <span>• Word/Excel/Aiken Import</span>
            <span>• Pick from Bank</span>
            <span>• Manual Editing</span>
          </div>
        </button>

        {/* Mode B: Dynamic Balanced Bank Draw */}
        <button
          type="button"
          onClick={() => onDynamicDrawChange(true)}
          className={`p-5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
            isDynamicDraw
              ? 'bg-purple-50/80 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Shuffle size={22} />
              </div>
              {isDynamicDraw ? (
                <span className="text-xs font-bold text-purple-700 bg-purple-100/90 border border-purple-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 size={12} /> Active Mode
                </span>
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300" />
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Dynamic Balanced Bank Draw (Leak-Proof)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Draw unique, stratified random question subsets from the Course Question Bank for each candidate.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-purple-100 flex items-center gap-3 text-xs text-purple-700 font-medium">
            <span>• Anti-Leak Batch Testing</span>
            <span>• Multi-Session Cohorts</span>
            <span>• Topic Balancing</span>
          </div>
        </button>
      </div>

      {/* CONTENT FOR MODE A: FIXED QUESTIONS */}
      {!isDynamicDraw ? (
        <Card className="border-slate-200/90 shadow-xs">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Questions in Exam ({questions.length})
                </h3>
                {questions.length > 0 && (
                  <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {totalMarks} Total Marks
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Add, upload, or pick questions. Students will see these questions in shuffled sequence.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {courseId && (
                <Button
                  variant="outline"
                  type="button"
                  size="sm"
                  onClick={onOpenBankPickerModal}
                  className="text-xs border-blue-300 text-blue-700 bg-blue-50/70 hover:bg-blue-100 font-bold flex items-center gap-1.5"
                >
                  <BookOpen size={14} />
                  <span>Pick from Bank</span>
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={onOpenUploadModal}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-2xs"
              >
                <Upload size={14} />
                <span>Upload / Ingest</span>
              </Button>
              <Button
                variant="secondary"
                type="button"
                size="sm"
                onClick={onDownloadTemplate}
                className="text-xs text-slate-700 flex items-center gap-1.5"
              >
                <Download size={14} />
                <span>Template</span>
              </Button>
              <Button
                variant="primary"
                type="button"
                size="sm"
                onClick={onOpenAddQuestionModal}
                className="text-xs flex items-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Question</span>
              </Button>
            </div>
          </div>

          {/* Auto-save to Question Bank Checkbox */}
          {courseId && (
            <div className="mb-4 p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-blue-900 font-medium">
                <input
                  type="checkbox"
                  checked={saveToQuestionBank}
                  onChange={(e) => onSaveToQuestionBankChange(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span>
                  Automatically save and calibrate these questions into the <strong>{selectedCourse?.code}</strong> Question Bank
                </span>
              </label>
              <span className="text-[11px] text-blue-700 font-semibold hidden sm:inline">
                Enables long-term item reuse
              </span>
            </div>
          )}

          {/* Questions Empty State vs Questions List */}
          {questions.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center bg-slate-50/50 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                <Upload size={28} />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-base font-bold text-slate-900">How would you like to add questions?</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Upload an existing exam document (.docx, .xlsx, Aiken .txt), pick from your calibrated bank, or enter questions manually.
                </p>
              </div>

              {/* Supported Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 py-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full">
                  <FileText size={12} /> Word (.docx)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full">
                  <FileSpreadsheet size={12} /> Excel (.xlsx)
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full">
                  <FileCode size={12} /> Aiken (.txt)
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={onOpenUploadModal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  <span>Upload File Now</span>
                </Button>
                {courseId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenBankPickerModal}
                    className="text-xs border-blue-300 text-blue-700 font-bold py-2 px-4 flex items-center gap-1.5"
                  >
                    <BookOpen size={14} />
                    <span>Browse Question Bank</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const options = parseOptions(q.options);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-slate-300 transition-all shadow-2xs group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-black text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <Badge variant="secondary" className="uppercase text-[10px] font-bold">
                          {q.question_type}
                        </Badge>
                        <Badge variant="primary" className="text-[10px] font-bold">
                          {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
                        </Badge>
                        {q.topic && (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            Topic: {q.topic}
                          </span>
                        )}
                      </div>

                      {/* Edit & Delete Controls */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEditQuestion(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit Question"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteQuestion(idx)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete Question"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Question Prompt */}
                    <p className="text-sm font-semibold text-slate-900 leading-relaxed mb-3">
                      {q.question_text}
                    </p>

                    {/* Options Grid (for MCQ) */}
                    {q.question_type === 'mcq' && options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {options.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const isCorrect = isOptionMatch(opt, optIdx, q.correct_answer, q.options);
                          return (
                            <div
                              key={optIdx}
                              className={`p-2 rounded-lg text-xs flex items-center gap-2 border ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {letter}
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Correct Answer Display for True/False */}
                    {q.question_type === 'true_false' && (
                      <div className="mt-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 p-2 rounded-lg border border-emerald-200 inline-block">
                        Correct Answer: {formatDisplayCorrectAnswer(q.correct_answer, [], 'true_false')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        /* CONTENT FOR MODE B: DYNAMIC QUESTION BANK DRAW */
        <Card className="border-purple-200 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-purple-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shuffle className="text-purple-600" size={18} />
                Dynamic Question Bank Configuration
              </h3>
              <p className="text-xs text-slate-500">
                Configure pool parameters and question quotas drawn dynamically for each candidate attempt.
              </p>
            </div>

            {/* Sessions Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSessionModal}
              className="text-xs border-purple-300 text-purple-700 bg-purple-50/70 hover:bg-purple-100 font-bold flex items-center gap-1.5"
            >
              <Users size={14} />
              <span>Multi-Session Batches {hasMultipleSessions ? '(Configured)' : ''}</span>
            </Button>
          </div>

          {!courseId ? (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>Please select an Institutional Course in Step 1 to draw questions from its Question Bank.</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Pool Readiness Meter */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-700">
                    Live Pool Capacity
                  </div>
                  <div className="text-2xl font-black text-purple-950 mt-0.5">
                    {activeQuestionsInPool} Questions Available
                  </div>
                  <p className="text-xs text-purple-700/80 mt-1">
                    {Number(drawQuestionCount) > 0 && activeQuestionsInPool > 0
                      ? `${drawQuestionCount} will be drawn per student. Overlap risk: ${
                          activeQuestionsInPool > Number(drawQuestionCount) * 2 ? 'Low (< 35%)' : 'Moderate'
                        }`
                      : 'Define draw count below to calculate cohort leak resistance.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-white/90 p-3 rounded-xl border border-purple-200 text-center min-w-[120px]">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Draw Count</div>
                    <input
                      type="number"
                      value={drawQuestionCount}
                      onChange={(e) => onDrawQuestionCountChange(e.target.value)}
                      min="1"
                      className="w-20 text-center font-black text-lg text-purple-900 border-b border-purple-300 focus:outline-none focus:border-purple-600 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Course Question Bank Scope Selector */}
              {courses.length > 1 && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Question Bank Course Scope
                  </label>
                  <p className="text-xs text-slate-500">
                    Draw strictly from {selectedCourse?.code} or blend companion courses for interdisciplinary assessments.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white shadow-2xs">
                      {selectedCourse?.code} (Primary)
                    </span>
                    {courses.filter(c => c.id !== courseId).map(c => {
                      const isSelected = poolCourseIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            onPoolCourseIdsChange(
                              isSelected
                                ? poolCourseIds.filter(id => id !== c.id)
                                : [...poolCourseIds, c.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 font-bold'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          + {c.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft size={16} />
          <span>Back to Basics</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          className="flex items-center gap-2 py-2.5 px-6 font-bold shadow-sm"
        >
          <span>Continue to Security & Proctoring</span>
          <ArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
};
