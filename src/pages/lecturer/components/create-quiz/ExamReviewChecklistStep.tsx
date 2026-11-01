import React from 'react';
import { 
  CheckCircle2, AlertTriangle, Eye, ArrowLeft, Send, 
  Save, BookOpen, Layers, Shield, Clock, Calendar, 
  HelpCircle, Sparkles, Check 
} from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Button from '../../../../components/ui/Button';
import { Course, Quiz } from '../../../../lib/database';
import { WizardStep, ValidationItem } from './types';
import { getCategoryLabel } from '../../../../utils/categoryUtils';

interface ExamReviewChecklistStepProps {
  courseId: string;
  courses: Course[];
  title: string;
  category: string;
  categoryPrefix: string;
  duration: string;
  deadlineDate: string;
  deadlineTime: string;
  isDynamicDraw: boolean;
  drawQuestionCount: string;
  activeQuestionsInPool: number;
  questionsCount: number;
  totalMarks: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  enableTabMonitoring: boolean;
  enableCopyPastePrevention: boolean;
  enableScreenRecording: boolean;
  requireSeb?: boolean;
  enableCameraProctoring?: boolean;
  allowReview?: boolean;
  currentQuizObj: Quiz | null;
  loading: boolean;
  onStepChange: (step: WizardStep) => void;
  onPreview: () => void;
  onSubmit: (submitForReview: boolean) => void;
  onBack: () => void;
}

export const ExamReviewChecklistStep: React.FC<ExamReviewChecklistStepProps> = ({
  courseId,
  courses,
  title,
  category,
  categoryPrefix,
  duration,
  deadlineDate,
  deadlineTime,
  isDynamicDraw,
  drawQuestionCount,
  activeQuestionsInPool,
  questionsCount,
  totalMarks,
  randomizeQuestions,
  randomizeOptions,
  enableTabMonitoring,
  enableCopyPastePrevention,
  enableScreenRecording,
  requireSeb = false,
  enableCameraProctoring = false,
  allowReview = true,
  currentQuizObj,
  loading,
  onStepChange,
  onPreview,
  onSubmit,
  onBack,
}) => {
  const selectedCourse = courses.find(c => c.id === courseId);

  // Validation Rules
  const checklist: ValidationItem[] = [
    {
      key: 'course',
      label: 'Institutional Course Assigned',
      step: 1,
      fieldId: 'course_id',
      isValid: Boolean(courseId),
      message: selectedCourse ? `${selectedCourse.code} - ${selectedCourse.title}` : 'Select a course in Step 1',
    },
    {
      key: 'title',
      label: 'Official Assessment Title',
      step: 1,
      fieldId: 'title',
      isValid: Boolean(title.trim()),
      message: title.trim() ? title : 'Provide a descriptive title in Step 1',
    },
    {
      key: 'duration',
      label: 'Duration Time Limit',
      step: 1,
      fieldId: 'duration',
      isValid: Number(duration) > 0,
      message: Number(duration) > 0 ? `${duration} minutes` : 'Specify exam duration in Step 1',
    },
    {
      key: 'questions',
      label: isDynamicDraw ? 'Dynamic Bank Capacity' : 'Questions Added',
      step: 2,
      fieldId: 'questions',
      isValid: isDynamicDraw
        ? Number(drawQuestionCount) > 0 && activeQuestionsInPool >= Number(drawQuestionCount)
        : questionsCount > 0,
      message: isDynamicDraw
        ? activeQuestionsInPool >= Number(drawQuestionCount)
          ? `${drawQuestionCount} questions drawn from pool of ${activeQuestionsInPool}`
          : `Bank only has ${activeQuestionsInPool} questions (need ${drawQuestionCount})`
        : questionsCount > 0
          ? `${questionsCount} questions configured (${totalMarks} total marks)`
          : 'Add or upload at least 1 question in Step 2',
    },
  ];

  const allValid = checklist.every(item => item.isValid);
  const validCount = checklist.filter(item => item.isValid).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Readiness Status Banner */}
      <div className={`p-5 rounded-2xl border transition-all ${
        allValid 
          ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-emerald-300 text-emerald-950 shadow-xs'
          : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-950 shadow-xs'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
              allValid ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}>
              {allValid ? <Check size={22} strokeWidth={3} /> : <AlertTriangle size={22} />}
            </div>
            <div>
              <h2 className="text-base font-black">
                {allValid ? 'Assessment is Ready for Launch!' : 'Complete Missing Items Before Submitting'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {allValid
                  ? 'All mandatory requirements are satisfied. You can preview or submit for moderation.'
                  : `${validCount} of ${checklist.length} checklist items verified. Click any item below to jump directly to it.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onPreview}
              disabled={!allValid}
              className="text-xs border-blue-400 text-blue-700 bg-white hover:bg-blue-50 font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <Eye size={15} />
              <span>Preview Student Experience</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive Readiness Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checklist.map((item) => (
          <div
            key={item.key}
            className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-3 ${
              item.isValid
                ? 'bg-white border-slate-200/90 shadow-2xs'
                : 'bg-amber-50/70 border-amber-300/80 shadow-xs'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold flex-shrink-0 ${
                item.isValid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {item.isValid ? <Check size={16} strokeWidth={3} /> : <AlertTriangle size={16} />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">{item.label}</div>
                <div className="text-[11px] text-slate-500 truncate">{item.message}</div>
              </div>
            </div>

            {!item.isValid && (
              <button
                type="button"
                onClick={() => onStepChange(item.step)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 underline flex-shrink-0 cursor-pointer"
              >
                Fix in Step {item.step} →
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Executive Summary Card */}
      <Card className="border-slate-200/90 shadow-xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <BookOpen className="text-blue-600" size={20} />
          <div>
            <h3 className="text-base font-bold text-slate-900">Executive Assessment Summary</h3>
            <p className="text-xs text-slate-500">Comprehensive configuration overview before publication.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Course</span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5 truncate">
              {selectedCourse?.code || 'Not selected'}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Classification</span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5 capitalize">
              {getCategoryLabel(category as any)}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Strategy</span>
            <span className="text-sm font-bold text-slate-900 block mt-0.5">
              {isDynamicDraw ? `Dynamic Draw (${drawQuestionCount} Qs)` : `Fixed (${questionsCount} Qs)`}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Marks</span>
            <span className="text-sm font-black text-blue-700 block mt-0.5">
              {isDynamicDraw ? `${drawQuestionCount} marks (est)` : `${totalMarks} marks`}
            </span>
          </div>
        </div>

        {/* Security Pills Summary */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
            Configured Proctoring Guards
          </span>
          <div className="flex flex-wrap gap-2">
            {randomizeQuestions && (
              <span className="text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg">
                ✓ Question Order Shuffled
              </span>
            )}
            {randomizeOptions && (
              <span className="text-xs font-medium bg-slate-100 border border-slate-200 text-slate-700 px-2.5 py-1 rounded-lg">
                ✓ Options Shuffled
              </span>
            )}
            {enableCopyPastePrevention && (
              <span className="text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg font-semibold">
                ✓ Copy/Paste Blocked
              </span>
            )}
            {enableTabMonitoring && (
              <span className="text-xs font-medium bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg font-semibold">
                ✓ Tab Switches Monitored
              </span>
            )}
            {requireSeb && (
              <span className="text-xs font-medium bg-amber-50 border border-amber-300 text-amber-800 px-2.5 py-1 rounded-lg font-semibold">
                🔒 Safe Exam Browser (SEB) Required
              </span>
            )}
            {enableCameraProctoring && (
              <span className="text-xs font-medium bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg font-semibold">
                📹 Webcam Proctoring Active
              </span>
            )}
            {enableScreenRecording && (
              <span className="text-xs font-medium bg-purple-50 border border-purple-200 text-purple-800 px-2.5 py-1 rounded-lg font-semibold">
                ✓ Screen Snapshots Active
              </span>
            )}
            {allowReview && (
              <span className="text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg font-semibold">
                ✓ Post-Exam Review Allowed
              </span>
            )}
            {deadlineDate && (
              <span className="text-xs font-medium bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded-lg font-semibold">
                📅 Deadline: {deadlineDate} {deadlineTime}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Main Final Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs font-bold"
        >
          <ArrowLeft size={16} />
          <span>Back to Security</span>
        </Button>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSubmit(false)}
            disabled={loading || !title.trim() || !courseId}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 font-semibold text-xs py-2.5 px-4"
          >
            <Save size={15} />
            <span>Save as Draft</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            onClick={() => onSubmit(true)}
            disabled={loading || !allValid}
            className={`w-full sm:w-auto flex items-center justify-center gap-2 font-black text-sm py-2.5 px-6 shadow-sm transition-all ${
              allValid ? 'bg-blue-600 hover:bg-blue-700 ring-2 ring-blue-500/20' : ''
            }`}
          >
            <Send size={16} />
            <span>
              {currentQuizObj?.status === 'rejected'
                ? 'Save & Resubmit for Review'
                : 'Submit for Review'}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};
