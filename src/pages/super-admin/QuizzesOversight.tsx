import { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { db } from '../../lib/database';

interface QuizRow {
  id: string;
  title: string;
  subject?: string;
  status: string;
  duration_minutes: number;
  total_marks: number;
  is_dynamic_draw?: boolean;
  draw_question_count?: number;
  fixed_question_count?: number;
  lecturer_name?: string;
  lecturer_email?: string;
  created_at: string;
  published_at?: string;
  deadline?: string;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  student_id: string;
  status: string;
  score?: number | null;
  raw_score?: number | null;
  total_possible_marks?: number | null;
  computed_raw_score?: number | null;
  computed_total_marks?: number | null;
  drawn_question_count?: number | null;
  started_at?: string;
  submitted_at?: string;
  cheated?: boolean;
  cheating_reason?: string;
  tab_switch_count?: number;
  student_name?: string;
  student_email?: string;
  student_index?: string;
}

export default function QuizzesOversight() {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [quizPage, setQuizPage] = useState(1);
  const [quizPageSize, setQuizPageSize] = useState(10);

  // Selected quiz & its submissions
  const [selectedQuiz, setSelectedQuiz] = useState<QuizRow | null>(null);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [attemptSearch, setAttemptSearch] = useState('');
  const [attemptPage, setAttemptPage] = useState(1);
  const [attemptPageSize, setAttemptPageSize] = useState(10);

  // Read-only submission inspector modal
  const [inspectedAttempt, setInspectedAttempt] = useState<AttemptRow | null>(null);
  const [attemptQuestions, setAttemptQuestions] = useState<any[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<any[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const data = await db.getAllQuizzesDebug();
      setQuizzes((data as QuizRow[]) || []);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const openQuizSubmissions = async (quiz: QuizRow) => {
    setSelectedQuiz(quiz);
    setAttemptSearch('');
    setAttemptPage(1);
    setAttemptsLoading(true);
    try {
      const rawAttempts = (await db.getQuizAttempts(quiz.id)) || [];
      const studentIds = Array.from(
        new Set(rawAttempts.map((a: any) => a.student_id).filter(Boolean))
      ) as string[];
      const profiles = studentIds.length > 0 ? await db.getProfilesByIds(studentIds) : [];
      const profileMap = new Map<string, any>(
        (profiles || []).map((p: any) => [p.id, p])
      );

      setAttempts(
        rawAttempts.map((a: any) => {
          const student = profileMap.get(a.student_id);
          return {
            ...a,
            student_name: student?.name || 'Unknown Student',
            student_email: student?.email || '',
            student_index: student?.index_number || '',
          };
        })
      );
    } catch (error) {
      console.error('Error loading quiz attempts:', error);
      setAttempts([]);
    } finally {
      setAttemptsLoading(false);
    }
  };

  const openInspector = async (attempt: AttemptRow) => {
    setInspectedAttempt(attempt);
    setInspectorLoading(true);
    try {
      const [questions, answers] = await Promise.all([
        db.getAttemptQuestions(attempt.id),
        db.getStudentAnswers(attempt.id),
      ]);
      setAttemptQuestions(questions || []);
      setStudentAnswers(answers || []);
    } catch (error) {
      console.error('Error inspecting attempt:', error);
      setAttemptQuestions([]);
      setStudentAnswers([]);
    } finally {
      setInspectorLoading(false);
    }
  };

  const filteredQuizzes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      if (statusFilter !== 'all' && quiz.status !== statusFilter) return false;
      if (!q) return true;
      return (
        quiz.title?.toLowerCase().includes(q) ||
        quiz.subject?.toLowerCase().includes(q) ||
        quiz.lecturer_name?.toLowerCase().includes(q)
      );
    });
  }, [quizzes, searchTerm, statusFilter]);

  const filteredAttempts = useMemo(() => {
    const q = attemptSearch.trim().toLowerCase();
    if (!q) return attempts;
    return attempts.filter(
      (a) =>
        a.student_name?.toLowerCase().includes(q) ||
        a.student_email?.toLowerCase().includes(q) ||
        a.student_index?.toLowerCase().includes(q)
    );
  }, [attempts, attemptSearch]);

  useEffect(() => {
    setQuizPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setAttemptPage(1);
  }, [attemptSearch]);

  const quizTotalPages = Math.max(1, Math.ceil(filteredQuizzes.length / quizPageSize));
  const paginatedQuizzes = useMemo(() => {
    const start = (quizPage - 1) * quizPageSize;
    return filteredQuizzes.slice(start, start + quizPageSize);
  }, [filteredQuizzes, quizPage, quizPageSize]);

  const attemptTotalPages = Math.max(1, Math.ceil(filteredAttempts.length / attemptPageSize));
  const paginatedAttempts = useMemo(() => {
    const start = (attemptPage - 1) * attemptPageSize;
    return filteredAttempts.slice(start, start + attemptPageSize);
  }, [filteredAttempts, attemptPage, attemptPageSize]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return <Badge variant="success">Published</Badge>;
      case 'approved':
        return <Badge variant="primary">Approved</Badge>;
      case 'pending_approval':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const answerMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const ans of studentAnswers) {
      map.set(ans.question_id, ans);
    }
    return map;
  }, [studentAnswers]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading quizzes & submissions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Quizzes & Submissions Oversight
          </h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Read-only platform visibility into all quizzes, attempt statuses, and student submissions.
          </p>
        </div>
        <Badge variant="primary" className="inline-flex items-center gap-1.5 self-start sm:self-auto">
          <Shield size={14} />
          Read-Only Oversight
        </Badge>
      </div>

      {!selectedQuiz ? (
        <>
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by quiz title, subject, or lecturer..."
                  className="pl-9"
                />
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'published', label: 'Published' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'pending_approval', label: 'Pending Approval' },
                  { value: 'draft', label: 'Draft' },
                  { value: 'rejected', label: 'Rejected' },
                  { value: 'archived', label: 'Archived' },
                ]}
              />
            </div>
          </Card>

          {/* Quizzes Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Quiz</th>
                    <th className="py-3 px-4">Lecturer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration / Marks</th>
                    <th className="py-3 px-4 text-right">Submissions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {paginatedQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                        No quizzes match your current filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedQuizzes.map((quiz) => (
                      <tr key={quiz.id} className="hover:bg-gray-50/70">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900">{quiz.title}</p>
                          <p className="text-xs text-gray-500">{quiz.subject || 'General'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-gray-900">{quiz.lecturer_name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{quiz.lecturer_email}</p>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(quiz.status)}</td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1">
                              <Clock size={13} /> {quiz.duration_minutes}m
                            </span>
                            <span>
                              {quiz.is_dynamic_draw && Number(quiz.draw_question_count) > 0
                                ? `${quiz.draw_question_count} Qs drawn from bank`
                                : `${quiz.fixed_question_count ?? '-'} Qs (${quiz.total_marks} marks)`}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openQuizSubmissions(quiz)}
                          >
                            <Users size={14} className="mr-1.5" />
                            View Submissions
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredQuizzes.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <Pagination
                  currentPage={quizPage}
                  totalPages={quizTotalPages}
                  onPageChange={setQuizPage}
                  totalItems={filteredQuizzes.length}
                  itemsPerPage={quizPageSize}
                  onItemsPerPageChange={(size) => {
                    setQuizPageSize(size);
                    setQuizPage(1);
                  }}
                />
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          {/* Selected Quiz Submissions View */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedQuiz(null)}>
                <ArrowLeft size={15} className="mr-1" />
                Back to Quizzes
              </Button>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedQuiz.title}</h2>
                <p className="text-xs text-gray-500">
                  {selectedQuiz.lecturer_name} •{' '}
                  {selectedQuiz.is_dynamic_draw && Number(selectedQuiz.draw_question_count) > 0
                    ? `${selectedQuiz.draw_question_count} questions to answer`
                    : `${selectedQuiz.fixed_question_count ?? '-'} questions to answer`}{' '}
                  • {attempts.length} attempt(s)
                </p>
              </div>
            </div>
            <div className="w-full sm:w-64 relative">
              <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              <Input
                value={attemptSearch}
                onChange={(e) => setAttemptSearch(e.target.value)}
                placeholder="Filter students..."
                className="pl-9"
              />
            </div>
          </Card>

          <Card className="overflow-hidden">
            {attemptsLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading submissions...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Questions</th>
                      <th className="py-3 px-4">Raw Marks</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Integrity</th>
                      <th className="py-3 px-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {paginatedAttempts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-500">
                          No submissions found for this quiz.
                        </td>
                      </tr>
                    ) : (
                      paginatedAttempts.map((attempt) => {
                        const requiredQuestions =
                          Number(attempt.drawn_question_count) > 0
                            ? Number(attempt.drawn_question_count)
                            : selectedQuiz.is_dynamic_draw && Number(selectedQuiz.draw_question_count) > 0
                              ? Number(selectedQuiz.draw_question_count)
                              : selectedQuiz.fixed_question_count ?? '-';
                        const isCompleted =
                          attempt.status === 'submitted' ||
                          attempt.status === 'graded' ||
                          (attempt.score !== null && attempt.score !== undefined);
                        const totalMarks =
                          attempt.total_possible_marks ??
                          (Number(attempt.computed_total_marks) > 0
                            ? Number(attempt.computed_total_marks)
                            : null) ??
                          (!selectedQuiz.is_dynamic_draw ? selectedQuiz.total_marks : null);
                        const rawMarks =
                          attempt.raw_score !== null && attempt.raw_score !== undefined
                            ? attempt.raw_score
                            : isCompleted &&
                                attempt.computed_raw_score !== null &&
                                attempt.computed_raw_score !== undefined
                              ? Number(attempt.computed_raw_score)
                              : isCompleted &&
                                  attempt.score !== null &&
                                  attempt.score !== undefined &&
                                  totalMarks
                                ? Math.round((Number(attempt.score) / 100) * Number(totalMarks) * 100) / 100
                                : null;

                        return (
                        <tr key={attempt.id} className="hover:bg-gray-50/70">
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900">{attempt.student_name}</p>
                            <p className="text-xs text-gray-500">
                              {attempt.student_index ? `${attempt.student_index} • ` : ''}
                              {attempt.student_email}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                attempt.status === 'submitted' || attempt.status === 'graded'
                                  ? 'success'
                                  : 'warning'
                              }
                            >
                              {attempt.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-700 font-medium">
                            {requiredQuestions} Qs
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-gray-900">
                            {rawMarks !== null && totalMarks ? (
                              <span>
                                {rawMarks} / {totalMarks}
                              </span>
                            ) : rawMarks !== null ? (
                              <span>{rawMarks}</span>
                            ) : (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-blue-700">
                            {attempt.score !== null && attempt.score !== undefined ? (
                              <span>{attempt.score}%</span>
                            ) : (
                              <span className="text-gray-400">Pending</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {attempt.cheated ? (
                              <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                                <AlertTriangle size={14} /> Flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-green-700">
                                <CheckCircle size={14} /> Clean
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openInspector(attempt)}
                            >
                              <Eye size={14} className="mr-1" />
                              Inspect
                            </Button>
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {!attemptsLoading && filteredAttempts.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200">
                <Pagination
                  currentPage={attemptPage}
                  totalPages={attemptTotalPages}
                  onPageChange={setAttemptPage}
                  totalItems={filteredAttempts.length}
                  itemsPerPage={attemptPageSize}
                  onItemsPerPageChange={(size) => {
                    setAttemptPageSize(size);
                    setAttemptPage(1);
                  }}
                />
              </div>
            )}
          </Card>
        </>
      )}

      {/* Read-Only Submission Inspector Modal */}
      <Modal
        isOpen={Boolean(inspectedAttempt)}
        onClose={() => setInspectedAttempt(null)}
        title={`Submission Inspector — ${inspectedAttempt?.student_name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-center gap-2">
            <Shield size={15} className="text-blue-600 flex-shrink-0" />
            <span>
              Read-only audit view. Answer editing and grade overrides are restricted to Lecturers and Academic Officers.
            </span>
          </div>

          {!inspectorLoading && inspectedAttempt && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-[11px] uppercase font-semibold text-gray-500">Questions</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {studentAnswers.length} / {attemptQuestions.length || (selectedQuiz?.is_dynamic_draw ? selectedQuiz.draw_question_count : selectedQuiz?.fixed_question_count ?? '-')}
                </p>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-[11px] uppercase font-semibold text-gray-500">Marks Obtained</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">
                  {inspectedAttempt.raw_score ?? studentAnswers.reduce((s, a) => s + Number(a.marks_obtained || 0), 0)}{' '}
                  / {inspectedAttempt.total_possible_marks || attemptQuestions.reduce((s, q) => s + Number(q.marks || 1), 0) || (!selectedQuiz?.is_dynamic_draw ? selectedQuiz?.total_marks : undefined) || '-'}
                </p>
              </div>
              <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-[11px] uppercase font-semibold text-gray-500">Percentage</p>
                <p className="text-sm font-bold text-blue-700 mt-0.5">
                  {inspectedAttempt.score !== null && inspectedAttempt.score !== undefined ? `${inspectedAttempt.score}%` : 'Pending'}
                </p>
              </div>
            </div>
          )}

          {inspectorLoading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading attempt details...</div>
          ) : attemptQuestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              No recorded questions found for this attempt.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {attemptQuestions.map((q, idx) => {
                const key = q.question_bank_id || q.question_id || q.id;
                const ans = answerMap.get(key) || answerMap.get(q.question_id) || answerMap.get(q.question_bank_id);
                return (
                  <div key={key || idx} className="p-3.5 border border-gray-200 rounded-lg bg-gray-50/50 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {idx + 1}. {q.question_text}
                      </p>
                      <Badge variant={ans?.is_correct ? 'success' : 'secondary'}>
                        {ans?.marks_obtained ?? 0} / {q.marks ?? 1}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">Student Answer:</span>{' '}
                      {ans?.answer_text || <span className="italic text-gray-400">No answer recorded</span>}
                    </p>
                    {q.correct_answer && (
                      <p className="text-xs text-green-700">
                        <span className="font-semibold">Correct Answer:</span> {q.correct_answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

