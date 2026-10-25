import { useState, useEffect } from 'react';
import { 
  Eye, CheckCircle2, Clock, Shield, Video, Monitor, 
  Lock, Shuffle, Award, Sparkles, Send,
  FileQuestion, Check, RefreshCw
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { db, AssessmentCategory, AssessmentCategoryItem } from '../../lib/database';
import { getCategoryColorBadgeClasses, ASSESSMENT_CATEGORIES } from '../../utils/categoryUtils';
import { parseOptions } from '../../utils/quizUtils';

export interface QuizPreviewData {
  title: string;
  description?: string;
  subject?: string;
  courseId?: string;
  courseCode?: string;
  courseTitle?: string;
  durationMinutes: number;
  totalMarks: number;
  category: AssessmentCategory;
  categoryPrefix?: string;
  courseCategories: AssessmentCategoryItem[];
  deadline?: string;
  requireSeb?: boolean;
  enableCameraProctoring?: boolean;
  enableScreenRecording?: boolean;
  enableTabMonitoring?: boolean;
  enableCopyPastePrevention?: boolean;
  allowReview?: boolean;
  showResultsImmediately?: boolean;
  isDynamicDraw: boolean;
  drawQuestionCount?: number;
  selectedPoolCategories?: string[];
  topicRules?: Record<string, number>;
  poolMode?: 'flat' | 'stratified';
  bankStats?: any;
  poolCourseIds?: string[];
  poolCourseCodes?: string[];
  selectedPoolTiers?: AssessmentCategory[];
  questions: Array<{
    course_id?: string;
    course_code?: string;
    assessment_tier?: AssessmentCategory;
    question_text: string;
    question_type: 'mcq' | 'true_false' | 'essay';
    options: string[];
    correct_answer: string;
    marks: number;
    topic?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
    category?: string;
    category_prefix?: string;
  }>;
}

interface QuizPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitForReview: () => void;
  data: QuizPreviewData;
}

export default function QuizPreviewModal({
  isOpen,
  onClose,
  onSubmitForReview,
  data
}: QuizPreviewModalProps) {
  const [viewMode, setViewMode] = useState<'student' | 'inspector'>('student');
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [sampleQuestions, setSampleQuestions] = useState<QuizPreviewData['questions']>([]);
  const [loadingSample, setLoadingSample] = useState(false);

  // Fetch sample drawn questions from question bank when dynamic draw is enabled
  const fetchSampleQuestions = async () => {
    if (!data.isDynamicDraw || !data.courseId) return;
    setLoadingSample(true);
    try {
      const targetCourseIds = Array.from(new Set([data.courseId, ...(data.poolCourseIds || [])].filter(Boolean)));
      let allBank: any[] = [];
      for (const cid of targetCourseIds) {
        const cBank = await db.getQuestionBankQuestions(cid, { status: 'active' });
        if (Array.isArray(cBank)) {
          allBank.push(...cBank);
        }
      }

      if (allBank.length === 0) {
        setSampleQuestions([]);
        return;
      }

      // Filter by selected assessment tiers if specified
      if (data.selectedPoolTiers && data.selectedPoolTiers.length > 0) {
        allBank = allBank.filter(q => q.assessment_tier && data.selectedPoolTiers?.includes(q.assessment_tier));
      }

      // Filter by selected pool categories if any
      let pool = allBank;
      if (data.selectedPoolCategories && data.selectedPoolCategories.length > 0) {
        pool = allBank.filter(q => {
          if (data.selectedPoolCategories?.includes('uncategorized') && (!q.category_prefix || q.category === 'General')) {
            return true;
          }
          return (
            (q.category_prefix && data.selectedPoolCategories?.includes(q.category_prefix)) ||
            (q.category && data.selectedPoolCategories?.includes(q.category))
          );
        });
      }

      // Stratified or uniform random selection
      let sampled: any[] = [];
      const drawTarget = data.drawQuestionCount || 10;

      if (data.poolMode === 'stratified' && data.topicRules && Object.values(data.topicRules).some(c => Number(c) > 0)) {
        const selectedIds = new Set<string>();
        Object.entries(data.topicRules).forEach(([topic, count]) => {
          if (Number(count) > 0) {
            const topicPool = pool.filter(q => (q.topic || 'General') === topic && !selectedIds.has(q.id));
            const shuffled = [...topicPool].sort(() => 0.5 - Math.random());
            const chosen = shuffled.slice(0, Number(count));
            chosen.forEach(c => selectedIds.add(c.id));
            sampled.push(...chosen);
          }
        });
        if (sampled.length < drawTarget) {
          const remaining = pool.filter(q => !selectedIds.has(q.id)).sort(() => 0.5 - Math.random());
          sampled.push(...remaining.slice(0, drawTarget - sampled.length));
        }
      } else {
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        sampled = shuffled.slice(0, drawTarget);
      }

      // Format questions for preview
      const formatted = sampled.map(item => {
        const parsedOpts = parseOptions(item.options);
        const opts = parsedOpts.length >= 4 
          ? parsedOpts.slice(0, 4) 
          : [...parsedOpts, ...Array(Math.max(0, 4 - parsedOpts.length)).fill('')];
        return {
          course_id: item.course_id,
          assessment_tier: item.assessment_tier,
          question_text: item.question_text,
          question_type: item.question_type as 'mcq' | 'true_false' | 'essay',
          options: opts,
          correct_answer: item.correct_answer || '',
          marks: item.marks || 1,
          topic: item.topic,
          difficulty: item.difficulty,
          category: item.category,
          category_prefix: item.category_prefix
        };
      });

      setSampleQuestions(formatted);
    } catch (err) {
      console.error('Failed to load sample bank questions for preview:', err);
    } finally {
      setLoadingSample(false);
    }
  };

  // Reset interactive selections and fetch sample on open
  useEffect(() => {
    if (isOpen) {
      setSelectedAnswers({});
      if (data.isDynamicDraw) {
        fetchSampleQuestions();
      }
    }
  }, [isOpen, data.isDynamicDraw, data.courseId]);

  const activeQuestionsList = data.isDynamicDraw ? sampleQuestions : data.questions;

  const categoryTier = ASSESSMENT_CATEGORIES.find(c => c.key === data.category);
  const activePrefixCategory = data.courseCategories.find(c => c.prefix === data.categoryPrefix);

  const handleSelectOption = (qIdx: number, val: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [qIdx]: val
    }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exam Quality & Pre-Submission Preview"
      size="xl"
    >
      <div className="space-y-5 -mt-2">
        {/* Top Control Bar: Mode Toggle & Exam Summary */}
        <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                {categoryTier?.label || 'Assessment'}
              </span>
              {data.courseCode && (
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-700/80 text-slate-200">
                  {data.courseCode}
                </span>
              )}
              {data.categoryPrefix && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border uppercase ${
                  getCategoryColorBadgeClasses(activePrefixCategory?.color)
                }`}>
                  [{data.categoryPrefix}] {activePrefixCategory?.name}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {data.title || 'Untitled Assessment'}
            </h2>
            <p className="text-xs text-slate-300 line-clamp-2">
              {data.description || 'No description provided.'}
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-xl border border-slate-700 self-start md:self-center">
            <button
              type="button"
              onClick={() => setViewMode('student')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'student'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileQuestion size={14} />
              <span>Student Simulation</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('inspector')}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'inspector'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 size={14} />
              <span>Answer Key & Audit</span>
            </button>
          </div>
        </div>

        {/* Security & Timing Profile Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
            <Clock size={14} className="text-blue-600" />
            <span>Duration: {data.durationMinutes} minutes</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-semibold border border-slate-200">
            <Award size={14} className="text-amber-600" />
            <span>Total Marks: {data.totalMarks} pts</span>
          </div>

          {data.requireSeb ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-900 font-semibold border border-amber-200">
              <Lock size={14} className="text-amber-600" />
              <span>Safe Exam Browser Enforced</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200">
              <span>Standard Browser Allowed</span>
            </div>
          )}

          {data.enableCameraProctoring && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-900 font-semibold border border-blue-200">
              <Video size={14} className="text-blue-600" />
              <span>Webcam Proctoring</span>
            </div>
          )}

          {data.enableScreenRecording && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-900 font-semibold border border-purple-200">
              <Monitor size={14} className="text-purple-600" />
              <span>Screen Recording</span>
            </div>
          )}

          {data.enableTabMonitoring && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-900 font-semibold border border-indigo-200">
              <Eye size={14} className="text-indigo-600" />
              <span>Tab Monitoring</span>
            </div>
          )}

          {data.enableCopyPastePrevention && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-900 font-semibold border border-rose-200">
              <Shield size={14} className="text-rose-600" />
              <span>Copy/Paste Disabled</span>
            </div>
          )}
        </div>

        {/* Dynamic Draw Info Notice (If Dynamic Bank Draw is active) */}
        {data.isDynamicDraw && (
          <div className="p-4 bg-purple-50/80 rounded-xl border border-purple-200 text-purple-950 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shuffle size={18} className="text-purple-700" />
                <h4 className="font-bold text-sm text-purple-900">
                  Dynamic Question Bank Draw Active
                </h4>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-800">
                {data.drawQuestionCount} Questions Drawn per Student
              </span>
            </div>

            <p className="text-xs text-purple-800 leading-relaxed">
              Each student will receive a unique, randomized subset of {data.drawQuestionCount} questions generated at the moment their exam session initiates.
            </p>

            {data.poolCourseCodes && data.poolCourseCodes.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 pt-1">
                <span>Multi-Course Pool:</span>
                <div className="flex flex-wrap gap-1">
                  <span className="px-2 py-0.5 bg-purple-200/80 rounded text-purple-900 font-bold border border-purple-300">
                    {data.courseCode} (Primary)
                  </span>
                  {data.poolCourseCodes.map((code) => (
                    <span key={code} className="px-2 py-0.5 bg-purple-100 rounded text-purple-800 border border-purple-300 font-bold">
                      {code}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.selectedPoolTiers && data.selectedPoolTiers.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 pt-0.5">
                <span>Target Assessment Tiers:</span>
                <div className="flex flex-wrap gap-1">
                  {data.selectedPoolTiers.map((tier) => (
                    <span key={tier} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold border border-indigo-200 uppercase text-[11px]">
                      {tier.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.selectedPoolCategories && data.selectedPoolCategories.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-900 pt-1">
                <span>Restricted Category Pool:</span>
                <div className="flex flex-wrap gap-1">
                  {data.selectedPoolCategories.map((catPref) => (
                    <span key={catPref} className="px-2 py-0.5 bg-purple-100 rounded text-purple-800 border border-purple-300 font-bold">
                      [{catPref}]
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.poolMode === 'stratified' && data.topicRules && Object.values(data.topicRules).some(c => Number(c) > 0) ? (
              <div className="mt-2 pt-2 border-t border-purple-200/60">
                <span className="text-xs font-bold text-purple-900 block mb-1">Stratified Topic Matrix Blueprint:</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                  {Object.entries(data.topicRules).filter(([_, count]) => Number(count) > 0).map(([topic, count]) => (
                    <div key={topic} className="flex items-center justify-between bg-white px-2.5 py-1 rounded border border-purple-200">
                      <span className="truncate text-gray-700">{topic}</span>
                      <strong className="text-purple-700 font-bold ml-1">{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-2 pt-2 border-t border-purple-200/60 flex items-center justify-between text-xs text-purple-800">
                <span>Draw Strategy: <strong>Uniform Random Draw</strong></span>
                <span className="text-[11px] text-purple-600">Drawn across all matching questions in the pool</span>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Draw Simulated Pool Notice & Re-roll Button */}
        {data.isDynamicDraw && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-purple-100/70 rounded-xl border border-purple-200 text-xs">
            <div className="flex items-center gap-2 text-purple-900 font-medium">
              <Sparkles size={16} className="text-purple-600 flex-shrink-0" />
              <span>
                <strong>Simulated Dynamic Draw:</strong> Displaying a random sample of {sampleQuestions.length} questions from the pool.
              </span>
            </div>
            <button
              type="button"
              onClick={fetchSampleQuestions}
              disabled={loadingSample}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-purple-700 border border-purple-300 font-bold hover:bg-purple-50 transition-all text-xs shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingSample ? 'animate-spin' : ''} />
              <span>Re-roll Sample Draw</span>
            </button>
          </div>
        )}

        {/* View Mode Banner Notice */}
        {viewMode === 'student' ? (
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-blue-600 flex-shrink-0" />
              <span>
                <strong>Student Simulation Active:</strong> Test and click options below to verify exam pacing and question readability.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('inspector')}
              className="text-blue-700 font-bold hover:underline ml-2"
            >
              Show Answer Keys &rarr;
            </button>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
              <span>
                <strong>Lecturer Audit Active:</strong> All correct answer keys, marks, and category metadata are highlighted for verification.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('student')}
              className="text-emerald-700 font-bold hover:underline ml-2"
            >
              Switch to Student View &rarr;
            </button>
          </div>
        )}

        {/* Questions Render List */}
        {loadingSample ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
            <RefreshCw size={28} className="animate-spin mx-auto text-purple-600 mb-2" />
            <p className="text-xs font-semibold text-gray-700">Drawing sample questions from Question Bank...</p>
          </div>
        ) : activeQuestionsList.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
            <FileQuestion size={36} className="mx-auto text-gray-400 mb-2" />
            <h4 className="text-sm font-bold text-gray-700">
              {data.isDynamicDraw ? 'No Matching Questions Found in Question Bank' : 'No Questions Added'}
            </h4>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {data.isDynamicDraw
                ? `Course ${data.courseCode || 'selected'} has no active questions matching the selected category pool${
                    data.selectedPoolCategories?.length ? ` [${data.selectedPoolCategories.join(', ')}]` : ''
                  }. Please add questions to the question bank or select different categories.`
                : 'Please add questions or import a CSV file before submitting.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {activeQuestionsList.map((q, qIndex) => {
              const isSelectedOption = (optVal: string) => selectedAnswers[qIndex] === optVal;
              const isCorrectOption = (optVal: string) => {
                const normVal = String(optVal).trim().toLowerCase();
                const normAns = String(q.correct_answer).trim().toLowerCase();
                if (q.question_type === 'mcq') {
                  // check letter key or exact option text
                  const optLetter = ['a', 'b', 'c', 'd'][q.options.indexOf(optVal)];
                  return normAns === optLetter || normAns === normVal;
                }
                return normAns === normVal;
              };

              return (
                <div
                  key={qIndex}
                  className={`p-4 rounded-xl border transition-all ${
                    viewMode === 'inspector'
                      ? 'bg-white border-slate-300 shadow-2xs'
                      : 'bg-white border-gray-200 hover:border-gray-300 shadow-2xs'
                  }`}
                >
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-md bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                        {qIndex + 1}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                        {q.question_type === 'mcq' ? 'Multiple Choice' : q.question_type === 'true_false' ? 'True / False' : 'Essay Question'}
                      </span>
                      {q.course_id && data.poolCourseCodes && data.poolCourseCodes.length > 0 && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-100">
                          {data.courseId === q.course_id ? (data.courseCode || 'Primary') : 'Partner Bank'}
                        </span>
                      )}
                      {q.assessment_tier && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {q.assessment_tier.replace('_', ' ')}
                        </span>
                      )}
                      {q.topic && (
                        <span className="text-xs font-medium px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                          {q.topic}
                        </span>
                      )}
                      {viewMode === 'inspector' && q.category_prefix && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase bg-purple-100 text-purple-800 border border-purple-200">
                          [{q.category_prefix}]
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                    </span>
                  </div>

                  {/* Question Prompt */}
                  <div className="text-sm font-semibold text-gray-900 mb-3 leading-relaxed whitespace-pre-wrap">
                    {q.question_text}
                  </div>

                  {/* MCQ Options */}
                  {q.question_type === 'mcq' && (
                    <div className="space-y-2">
                      {q.options.filter(Boolean).map((opt: string, optIdx: number) => {
                        const letter = ['A', 'B', 'C', 'D'][optIdx];
                        const isChosen = isSelectedOption(letter) || isSelectedOption(opt);
                        const isAnswerKey = isCorrectOption(opt);

                        let optionStyle = 'bg-slate-50/70 border-slate-200 text-slate-800 hover:bg-slate-100';
                        if (viewMode === 'student') {
                          if (isChosen) {
                            optionStyle = 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs ring-1 ring-blue-400';
                          }
                        } else {
                          // Inspector Mode
                          if (isAnswerKey) {
                            optionStyle = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold ring-2 ring-emerald-400/30';
                          } else {
                            optionStyle = 'bg-white border-slate-200 text-slate-600';
                          }
                        }

                        return (
                          <div
                            key={optIdx}
                            onClick={() => viewMode === 'student' && handleSelectOption(qIndex, letter)}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${optionStyle}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-5 h-5 rounded-md font-bold flex items-center justify-center text-[11px] ${
                                viewMode === 'inspector' && isAnswerKey
                                  ? 'bg-emerald-600 text-white'
                                  : isChosen
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}>
                                {letter}
                              </span>
                              <span>{opt}</span>
                            </div>

                            {viewMode === 'inspector' && isAnswerKey && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                                <Check size={12} />
                                <span>Correct Answer</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* True / False Options */}
                  {q.question_type === 'true_false' && (
                    <div className="flex gap-3">
                      {['True', 'False'].map((tfVal) => {
                        const isChosen = selectedAnswers[qIndex]?.toLowerCase() === tfVal.toLowerCase();
                        const isAnswerKey = String(q.correct_answer).toLowerCase() === tfVal.toLowerCase();

                        let tfStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
                        if (viewMode === 'student') {
                          if (isChosen) {
                            tfStyle = 'bg-blue-50 border-blue-500 text-blue-900 ring-1 ring-blue-400 font-bold';
                          }
                        } else {
                          if (isAnswerKey) {
                            tfStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold ring-2 ring-emerald-400/30';
                          } else {
                            tfStyle = 'bg-white border-slate-200 text-slate-500';
                          }
                        }

                        return (
                          <button
                            key={tfVal}
                            type="button"
                            onClick={() => viewMode === 'student' && handleSelectOption(qIndex, tfVal)}
                            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${tfStyle}`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full ${
                              viewMode === 'inspector' && isAnswerKey
                                ? 'bg-emerald-600'
                                : isChosen
                                ? 'bg-blue-600'
                                : 'bg-slate-300'
                            }`} />
                            <span>{tfVal}</span>
                            {viewMode === 'inspector' && isAnswerKey && (
                              <span className="text-[10px] text-emerald-700 font-bold">(Key)</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Essay Prompt Box */}
                  {q.question_type === 'essay' && (
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
                        {viewMode === 'student' ? (
                          <span>Student text area for free-response essay answer...</span>
                        ) : (
                          <div className="not-italic space-y-1">
                            <strong className="text-amber-900 block">Essay Question (Manual Grading):</strong>
                            <p className="text-slate-700">
                              {q.correct_answer ? `Expected Evaluation Criteria / Rubric: ${q.correct_answer}` : 'No model rubric provided.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Action Footer */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            &larr; Back to Editor
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onSubmitForReview();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Send size={15} />
              <span>Confirm & Submit for Review</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
