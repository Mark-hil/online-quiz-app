import { useState, useMemo, useEffect, FormEvent } from 'react';
import {
  Send,
  AlertTriangle,
  GraduationCap,
  Calendar,
  CheckSquare,
  Square,
  Layers,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import { db, Quiz, ExamResultsTransmission } from '../../../lib/database';
import { useAuth } from '../../../contexts/AuthContext';
import { getLetterGrade, parseNumericScore } from '../../../utils/academicExportUtils';

interface TransmitResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizzes: Quiz[];
  selectedQuizId?: string;
  allSubmissions: any[];
  existingTransmissions?: ExamResultsTransmission[];
  onSuccess: (count: number) => void;
}

export default function TransmitResultsModal({
  isOpen,
  onClose,
  quizzes,
  selectedQuizId,
  allSubmissions,
  existingTransmissions = [],
  onSuccess,
}: TransmitResultsModalProps) {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const defaultYear = `${currentYear}/${currentYear + 1}`;

  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [academicYear, setAcademicYear] = useState(defaultYear);
  const [semester, setSemester] = useState('Semester 1');
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [isCertified, setIsCertified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute stats for every quiz
  const quizzesWithStats = useMemo(() => {
    return quizzes.map((q) => {
      const subs = allSubmissions.filter((s) => s.quiz_id === q.id);
      const scores = subs
        .map((s) => parseNumericScore(s.score))
        .filter((s): s is number => s !== null);

      const passed = subs.filter((s) => {
        const scoreVal = parseNumericScore(s.score);
        return scoreVal !== null && scoreVal >= 50;
      }).length;
      const failed = subs.length - passed;
      const avg = subs.length > 0 ? scores.reduce((a, b) => a + b, 0) / subs.length : 0;
      const highest = scores.length > 0 ? Math.max(...scores) : 0;
      const lowest = scores.length > 0 ? Math.min(...scores) : 0;
      const passRate = subs.length > 0 ? Math.round((passed / subs.length) * 100) : 0;

      const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      subs.forEach((s) => {
        const { grade } = getLetterGrade(s.score);
        if (grade in gradeCounts) {
          gradeCounts[grade]++;
        }
      });

      const existingTransmission = existingTransmissions.find((t) => t.quiz_id === q.id);

      return {
        quiz: q,
        submissions: subs,
        total: subs.length,
        passed,
        failed,
        avg: Math.round(avg * 10) / 10,
        highest: Math.round(highest * 10) / 10,
        lowest: Math.round(lowest * 10) / 10,
        passRate,
        gradeCounts,
        existingTransmission,
      };
    });
  }, [quizzes, allSubmissions, existingTransmissions]);

  // Initialize selected quizzes when modal opens or filter changes
  useEffect(() => {
    if (!isOpen) return;

    if (selectedQuizId && selectedQuizId !== 'all') {
      setSelectedQuizIds([selectedQuizId]);
      const match = existingTransmissions.find((t) => t.quiz_id === selectedQuizId);
      if (match) {
        setAcademicYear(match.academic_year || defaultYear);
        setSemester(match.semester || 'Semester 1');
        setSubmissionNotes(match.submission_notes || '');
      }
    } else {
      // Default to all quizzes that have candidate submissions
      const quizzesWithSubs = quizzesWithStats.filter((q) => q.total > 0).map((q) => q.quiz.id);
      if (quizzesWithSubs.length > 0) {
        setSelectedQuizIds(quizzesWithSubs);
      } else if (quizzes.length > 0) {
        setSelectedQuizIds([quizzes[0].id]);
      }
    }
    setIsCertified(false);
    setError(null);
  }, [isOpen, selectedQuizId, quizzes, quizzesWithStats, existingTransmissions, defaultYear]);

  // Aggregate metrics for selected quizzes
  const aggregateMetrics = useMemo(() => {
    const selectedStats = quizzesWithStats.filter((item) =>
      selectedQuizIds.includes(item.quiz.id)
    );

    let totalSubmissions = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const allScores: number[] = [];
    const combinedGradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };

    selectedStats.forEach((item) => {
      totalSubmissions += item.total;
      totalPassed += item.passed;
      totalFailed += item.failed;
      item.submissions.forEach((s) => {
        const val = parseNumericScore(s.score);
        if (val !== null) {
          allScores.push(val);
        }
      });
      Object.entries(item.gradeCounts).forEach(([k, v]) => {
        combinedGradeCounts[k] = (combinedGradeCounts[k] || 0) + v;
      });
    });

    const overallAvg =
      allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : 0;
    const overallHighest = allScores.length > 0 ? Math.max(...allScores) : 0;
    const overallLowest = allScores.length > 0 ? Math.min(...allScores) : 0;
    const overallPassRate =
      totalSubmissions > 0 ? Math.round((totalPassed / totalSubmissions) * 100) : 0;

    return {
      selectedCount: selectedStats.length,
      totalSubmissions,
      totalPassed,
      totalFailed,
      overallAvg,
      overallHighest,
      overallLowest,
      overallPassRate,
      gradeCounts: combinedGradeCounts,
    };
  }, [quizzesWithStats, selectedQuizIds]);

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizIds((prev) =>
      prev.includes(quizId) ? prev.filter((id) => id !== quizId) : [...prev, quizId]
    );
  };

  const selectAllWithSubmissions = () => {
    const withSubs = quizzesWithStats.filter((q) => q.total > 0).map((q) => q.quiz.id);
    setSelectedQuizIds(withSubs.length > 0 ? withSubs : quizzes.map((q) => q.id));
  };

  const clearSelection = () => {
    setSelectedQuizIds([]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedQuizIds.length === 0) {
      setError('Please select at least one quiz to transmit to the Academic Office.');
      return;
    }

    if (!isCertified) {
      setError('You must confirm internal examination sign-off before transmission.');
      return;
    }

    if (!academicYear.trim()) {
      setError('Please provide an academic year (e.g. 2025/2026).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const selectedStats = quizzesWithStats.filter((item) =>
        selectedQuizIds.includes(item.quiz.id)
      );

      // Transmit all selected quizzes
      for (const stat of selectedStats) {
        await db.createExamTransmission({
          quiz_id: stat.quiz.id,
          lecturer_id: user.id,
          academic_year: academicYear.trim(),
          semester,
          submission_notes: submissionNotes.trim() || undefined,
          total_candidates: stat.total,
          passed_candidates: stat.passed,
          failed_candidates: stat.failed,
          average_score: stat.avg,
          highest_score: stat.highest,
          lowest_score: stat.lowest,
          grade_counts: stat.gradeCounts,
        });

        // Create individual audit log
        await db.createAuditLog(
          user.id,
          'EXAM_RESULTS_TRANSMITTED',
          'quiz',
          stat.quiz.id,
          {
            quiz_title: stat.quiz.title,
            academic_year: academicYear.trim(),
            semester,
            candidates: stat.total,
            pass_rate: `${stat.passRate}%`,
            average_score: `${stat.avg}%`,
            batch_size: selectedStats.length,
          }
        );
      }

      onSuccess(selectedStats.length);
      onClose();
    } catch (err: any) {
      console.error('Error transmitting exam results:', err);
      setError(
        err.message || 'Failed to transmit exam results package. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transmit Examination Results to Academic Office"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Master Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 rounded-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="bg-blue-500/30 text-blue-200 border-blue-400/30">
                Official Broad-Sheet Transmission
              </Badge>
              <span className="text-xs text-blue-300">
                Institutional Records Pipeline
              </span>
            </div>
            <h4 className="text-lg font-bold text-white">
              {aggregateMetrics.selectedCount === 1
                ? quizzesWithStats.find((q) => selectedQuizIds.includes(q.quiz.id))?.quiz.title
                : `Batch Transmission: ${aggregateMetrics.selectedCount} Exams Selected`}
            </h4>
            <p className="text-xs text-blue-200">
              Assigned Lecturer: <span className="font-semibold text-white">{user?.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/10 p-3 rounded-lg backdrop-blur-sm self-start sm:self-auto">
            <div className="text-center px-2">
              <span className="text-[10px] uppercase text-blue-300 block font-bold">Exams</span>
              <span className="text-2xl font-black text-white">{aggregateMetrics.selectedCount}</span>
            </div>
            <div className="w-px h-8 bg-blue-300/20" />
            <div className="text-center px-2">
              <span className="text-[10px] uppercase text-blue-300 block font-bold">Candidates</span>
              <span className="text-2xl font-black text-white">{aggregateMetrics.totalSubmissions}</span>
            </div>
          </div>
        </div>

        {/* Multi-Quiz Course Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-600" />
              Select Quizzes / Examinations to Transmit ({selectedQuizIds.length} of {quizzes.length} selected)
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllWithSubmissions}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Select All with Submissions
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-gray-500 hover:text-gray-700 font-medium"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white shadow-inner">
            {quizzesWithStats.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                No quizzes available in your account.
              </div>
            ) : (
              quizzesWithStats.map((item) => {
                const isSelected = selectedQuizIds.includes(item.quiz.id);
                return (
                  <div
                    key={item.quiz.id}
                    onClick={() => toggleQuizSelection(item.quiz.id)}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/60 hover:bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-blue-600 flex-shrink-0">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.quiz.title}
                          </p>
                          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                            {item.quiz.subject || 'General'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>
                            <b>{item.total}</b> candidate{item.total === 1 ? '' : 's'}
                          </span>
                          {item.total > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 font-medium">
                                {item.passRate}% pass rate
                              </span>
                              <span>•</span>
                              <span>Avg: {item.avg}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.existingTransmission ? (
                        <Badge
                          variant={
                            item.existingTransmission.status === 'verified'
                              ? 'primary'
                              : item.existingTransmission.status === 'revision_requested'
                              ? 'danger'
                              : 'warning'
                          }
                          className="text-[10px] uppercase"
                        >
                          {item.existingTransmission.status.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-gray-400 font-medium">
                          Not Transmitted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Aggregated Statistical Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Selected Pass Rate</span>
            <p className="text-xl font-extrabold text-emerald-700">
              {aggregateMetrics.overallPassRate}%
            </p>
            <span className="text-[11px] text-slate-500">
              {aggregateMetrics.totalPassed}P / {aggregateMetrics.totalFailed}F
            </span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Class Mean</span>
            <p className="text-xl font-extrabold text-blue-700">
              {aggregateMetrics.overallAvg}%
            </p>
            <span className="text-[11px] text-slate-500">Weighted Average</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">High Score</span>
            <p className="text-xl font-extrabold text-indigo-700">
              {aggregateMetrics.overallHighest}%
            </p>
            <span className="text-[11px] text-slate-500">Top Candidate</span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Low Score</span>
            <p className="text-xl font-extrabold text-slate-700">
              {aggregateMetrics.overallLowest}%
            </p>
            <span className="text-[11px] text-slate-500">Floor Score</span>
          </div>
        </div>

        {/* Combined Grade Distribution Curve */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1.5">
            <span>Cumulative Grade Curve:</span>
            <span className="text-gray-500 font-normal">A: ≥80% | B: 70-79% | C: 60-69% | D: 50-59% | F: &lt;50%</span>
          </div>
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            <div className="p-1.5 bg-emerald-100/70 text-emerald-900 rounded font-bold">
              A: {aggregateMetrics.gradeCounts.A}
            </div>
            <div className="p-1.5 bg-blue-100/70 text-blue-900 rounded font-bold">
              B: {aggregateMetrics.gradeCounts.B}
            </div>
            <div className="p-1.5 bg-purple-100/70 text-purple-900 rounded font-bold">
              C: {aggregateMetrics.gradeCounts.C}
            </div>
            <div className="p-1.5 bg-amber-100/70 text-amber-900 rounded font-bold">
              D: {aggregateMetrics.gradeCounts.D}
            </div>
            <div className="p-1.5 bg-rose-100/70 text-rose-900 rounded font-bold">
              F: {aggregateMetrics.gradeCounts.F}
            </div>
          </div>
        </div>

        {/* Academic Term Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Academic Year <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2025/2026"
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Academic Semester / Term <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <GraduationCap size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                required
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Trimester 1">Trimester 1</option>
                <option value="Trimester 2">Trimester 2</option>
                <option value="Trimester 3">Trimester 3</option>
                <option value="Summer Term">Summer Term</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lecturer Remarks */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Lecturer Remarks / Commentary for Academic Office (Optional)
          </label>
          <textarea
            rows={3}
            value={submissionNotes}
            onChange={(e) => setSubmissionNotes(e.target.value)}
            placeholder="Provide any institutional context regarding candidate cohorts, moderation adjustments, or examination anomalies across selected courses..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Sign-Off Certification Checkbox */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isCertified}
              onChange={(e) => setIsCertified(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold block">Internal Examiner Sign-Off & Attestation</span>
              I certify that candidate submissions for all {aggregateMetrics.selectedCount} selected examination(s) have been verified, assessed, and finalized in accordance with institutional academic regulations. I officially authorize the transmission of these examination broadsheets to the Academic Office.
            </div>
          </label>
        </div>

        {/* Sticky Modal Actions Bar - Always visible at the bottom */}
        <div className="sticky bottom-0 -mx-6 -mb-6 p-4 px-6 bg-white/95 backdrop-blur-md border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-20">
          <div className="text-xs text-gray-500 font-medium">
            {!isCertified ? (
              <span className="text-amber-700 font-medium flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                <AlertTriangle size={13} className="text-amber-600 flex-shrink-0" />
                Please check the attestation box above to enable transmission
              </span>
            ) : (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                ✓ Certified by Internal Examiner
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !isCertified ||
                selectedQuizIds.length === 0 ||
                aggregateMetrics.totalSubmissions === 0
              }
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 shadow-md font-bold px-5 py-2.5"
            >
              <Send size={15} />
              {isSubmitting
                ? 'Transmitting...'
                : `Sign & Transmit ${aggregateMetrics.selectedCount} Exam${aggregateMetrics.selectedCount === 1 ? '' : 's'} to Academic Office`}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
