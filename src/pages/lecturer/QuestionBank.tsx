import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Textarea from '../../components/ui/Textarea';
import { 
  db, Course, QuestionBankItem, QuestionBankAccessRequest, AssessmentCategoryItem, AssessmentCategory 
} from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import QuestionEditorModal, { QuestionForm } from '../../components/lecturer/QuestionEditorModal';
import AssessmentCategoryModal from '../../components/lecturer/AssessmentCategoryModal';
import UniversalQuestionIngestionModal from '../../components/lecturer/UniversalQuestionIngestionModal';
import BankAccessManagementModal from '../../components/lecturer/BankAccessManagementModal';
import { AddCourseModal } from './components/create-quiz/AddCourseModal';
import { ParsedIngestionQuestion } from '../../utils/questionIngestionParsers';
import { getCategoryColorBadgeClasses } from '../../utils/categoryUtils';
import { exportQuestionsToCSVString, downloadCSVFile } from '../../utils/csvQuestionUtils';
import { parseOptions } from '../../utils/quizUtils';

// Sub-components
import BankHeader from './components/question-bank/BankHeader';
import BankStatsDashboard from './components/question-bank/BankStatsDashboard';
import BankFiltersToolbar from './components/question-bank/BankFiltersToolbar';
import BankBatchActionBar from './components/question-bank/BankBatchActionBar';
import QuestionBankCard from './components/question-bank/QuestionBankCard';
import RestrictedBankView from './components/question-bank/RestrictedBankView';
import EmptyBankState from './components/question-bank/EmptyBankState';
import { BankStats, StatusFilterType, TierFilterType } from './components/question-bank/types';

export default function QuestionBank() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Courses & Access state
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  // Question Bank items
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [bankStats, setBankStats] = useState<BankStats | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('active');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<TierFilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Categories & Prefixes state
  const [courseCategories, setCourseCategories] = useState<AssessmentCategoryItem[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showBatchCategoryModal, setShowBatchCategoryModal] = useState(false);
  const [batchTargetPrefix, setBatchTargetPrefix] = useState('');

  // Access delegation requests
  const [pendingRequests, setPendingRequests] = useState<QuestionBankAccessRequest[]>([]);
  const [userPendingRequest, setUserPendingRequest] = useState<QuestionBankAccessRequest | null>(null);
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestPermission, setRequestPermission] = useState<'read_only' | 'contributor'>('read_only');
  const [requestDuration, setRequestDuration] = useState('7');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Review and Delegation modal (for Lead Lecturer / Admin / Academic Officer)
  const [showAccessManagementModal, setShowAccessManagementModal] = useState(false);

  // Add / Edit Question Modal
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState({
    topic: 'General',
    category: 'General',
    category_prefix: '',
    assessment_tier: 'quiz' as AssessmentCategory,
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    question_type: 'mcq' as 'mcq' | 'true_false' | 'essay',
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1,
    status: 'active' as 'active' | 'retired' | 'draft'
  });

  // Import / Add Course Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isClaimingCourse, setIsClaimingCourse] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Load courses
  useEffect(() => {
    loadCourses();
  }, [user]);

  const loadCourses = async () => {
    if (!user) return;
    setLoadingCourses(true);
    try {
      const data = await db.getCourses(user.id);
      setCourses(data as Course[]);
      if (data.length > 0 && !selectedCourseId) {
        const accessible = (data as any[]).find(c => c.hasAccess);
        setSelectedCourseId(accessible ? accessible.id : data[0].id);
      }
    } catch (error) {
      console.error('Error loading courses:', error);
      showToast('Failed to load courses', 'error');
    } finally {
      setLoadingCourses(false);
    }
  };

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || undefined;
  }, [courses, selectedCourseId]);

  const isCourseLead = useMemo(() => {
    if (!user || !selectedCourse) return false;
    return selectedCourse.assigned_lecturer_id === user.id || user.role === 'admin' || user.role === 'super_admin';
  }, [user, selectedCourse]);

  const hasCourseAccess = useMemo(() => {
    if (!user || !selectedCourse) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return (selectedCourse as any).hasAccess === true;
  }, [user, selectedCourse]);

  const handleClaimCourse = async (courseId?: string) => {
    const targetId = courseId || selectedCourseId;
    if (!targetId || !user) return;
    setIsClaimingCourse(true);
    try {
      await db.assignCourseLecturer(targetId, user.id);
      showToast(`Successfully assigned to course! Full access granted.`, 'success');
      await loadCourses();
    } catch (err) {
      console.error('Failed to claim course:', err);
      showToast('Failed to claim course.', 'error');
    } finally {
      setIsClaimingCourse(false);
    }
  };

  // Load questions and requests whenever selectedCourseId changes
  useEffect(() => {
    if (selectedCourseId) {
      loadCourseData();
    }
  }, [selectedCourseId, selectedCourse]);

  const loadCourseData = async () => {
    if (!selectedCourseId || !user) return;

    if (hasCourseAccess) {
      setLoadingQuestions(true);
      try {
        const [qData, stats, cats] = await Promise.all([
          db.getQuestionBankQuestions(selectedCourseId),
          db.getQuestionBankStats(selectedCourseId),
          db.getAssessmentCategories(selectedCourseId)
        ]);
        setQuestions(qData as QuestionBankItem[]);
        setBankStats(stats as BankStats);
        setCourseCategories(cats || []);
      } catch (err) {
        console.error('Failed to load questions:', err);
      } finally {
        setLoadingQuestions(false);
      }
    } else {
      setQuestions([]);
      setBankStats(null);
      setCourseCategories([]);
      try {
        const userReqs = await db.getBankAccessRequests({
          course_id: selectedCourseId,
          requester_id: user.id,
          status: 'pending'
        });
        setUserPendingRequest(userReqs.length > 0 ? (userReqs[0] as QuestionBankAccessRequest) : null);
      } catch (e) {
        console.error('Error fetching user access request:', e);
      }
    }

    if (isCourseLead) {
      try {
        const leadReqs = await db.getBankAccessRequests({
          course_id: selectedCourseId,
          status: 'pending'
        });
        setPendingRequests(leadReqs as QuestionBankAccessRequest[]);
      } catch (e) {
        console.error('Error fetching lead pending requests:', e);
      }
    } else {
      setPendingRequests([]);
    }
  };

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchText = q.question_text.toLowerCase().includes(term);
        const matchTopic = (q.topic || '').toLowerCase().includes(term);
        const matchCategory = (q.category || '').toLowerCase().includes(term);
        const matchPrefix = (q.category_prefix || '').toLowerCase().includes(term);
        if (!matchText && !matchTopic && !matchCategory && !matchPrefix) return false;
      }
      if (statusFilter !== 'all' && q.status !== statusFilter) {
        return false;
      }
      if (topicFilter !== 'all' && q.topic !== topicFilter) {
        return false;
      }
      if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) {
        return false;
      }
      if (tierFilter !== 'all' && (q.assessment_tier || 'quiz') !== tierFilter) {
        return false;
      }
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'uncategorized') {
          if (q.category_prefix || (q.category && q.category !== 'General')) return false;
        } else {
          const matchPrefix = q.category_prefix && q.category_prefix.toUpperCase() === categoryFilter.toUpperCase();
          const matchCat = q.category && q.category.toLowerCase() === categoryFilter.toLowerCase();
          if (!matchPrefix && !matchCat) return false;
        }
      }
      return true;
    });
  }, [questions, searchTerm, statusFilter, topicFilter, difficultyFilter, categoryFilter, tierFilter]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, topicFilter, difficultyFilter, categoryFilter, tierFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuestions.slice(start, start + itemsPerPage);
  }, [filteredQuestions, currentPage]);

  // Quick stat filter shortcut
  const handleStatFilterClick = (type: 'all' | 'active' | 'easy' | 'medium' | 'hard') => {
    if (type === 'all') {
      setStatusFilter('all');
      setDifficultyFilter('all');
    } else if (type === 'active') {
      setStatusFilter('active');
      setDifficultyFilter('all');
    } else {
      setDifficultyFilter(type);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDifficultyFilter('all');
    setTopicFilter('all');
    setCategoryFilter('all');
    setTierFilter('all');
  };

  // Selection handlers
  const handleToggleSelectQuestion = (id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllPage = () => {
    if (selectedQuestionIds.size === paginatedQuestions.length && paginatedQuestions.length > 0) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(paginatedQuestions.map(q => q.id)));
    }
  };

  const handleBulkRetire = async () => {
    if (selectedQuestionIds.size === 0) return;
    if (!confirm(`Retire ${selectedQuestionIds.size} selected question(s)? They will be moved to the archive.`)) return;
    try {
      await Promise.all(
        Array.from(selectedQuestionIds).map(id => db.updateQuestionBankItem(id, { status: 'retired' }))
      );
      showToast(`Retired ${selectedQuestionIds.size} questions!`);
      setSelectedQuestionIds(new Set());
      loadCourseData();
    } catch (err) {
      console.error('Failed to bulk retire:', err);
      showToast('Failed to bulk retire questions.', 'error');
    }
  };

  const handleCreateQuizFromSelected = () => {
    if (selectedQuestionIds.size === 0 || !selectedCourse) return;
    const toExport = questions.filter(q => selectedQuestionIds.has(q.id));
    sessionStorage.setItem('preloaded_quiz_questions', JSON.stringify({
      course_id: selectedCourseId,
      questions: toExport
    }));
    navigate(`/lecturer/create-quiz?fromBank=true&courseId=${selectedCourseId}`);
  };

  // Submit Access Request
  const handleSubmitAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCourseId || !requestReason.trim()) return;

    setIsSubmittingRequest(true);
    try {
      await db.requestBankAccess({
        course_id: selectedCourseId,
        requester_id: user.id,
        reason: requestReason.trim(),
        access_level: requestPermission,
        duration_days: parseInt(requestDuration, 10) || 7
      });
      showToast('Access request submitted successfully to Lead Lecturer and Admin.', 'success');
      setShowRequestAccessModal(false);
      setRequestReason('');
      loadCourseData();
    } catch (err) {
      console.error('Failed to submit access request:', err);
      showToast('Could not submit access request. Please try again.', 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Save Question (Create or Edit)
  const handleSaveQuestion = async (saved: QuestionForm) => {
    if (!selectedCourseId || !saved.question_text.trim()) {
      showToast('Question text is required', 'error');
      return;
    }

    try {
      if (isEditing && editingQuestionId) {
        await db.updateQuestionBankItem(editingQuestionId, {
          topic: saved.topic?.trim() || 'General',
          category: saved.category?.trim() || 'General',
          category_prefix: saved.category_prefix ? saved.category_prefix.toUpperCase().trim() : null,
          assessment_tier: saved.assessment_tier || 'quiz',
          difficulty: saved.difficulty || 'medium',
          question_type: saved.question_type,
          question_text: saved.question_text.trim(),
          options: saved.question_type === 'mcq' ? saved.options : [],
          correct_answer: saved.correct_answer,
          marks: Number(saved.marks) || 1,
          status: saved.status || 'active'
        });
        showToast('Question updated successfully');
      } else {
        await db.createQuestionBankItem({
          course_id: selectedCourseId,
          topic: saved.topic?.trim() || 'General',
          category: saved.category?.trim() || 'General',
          category_prefix: saved.category_prefix ? saved.category_prefix.toUpperCase().trim() : null,
          assessment_tier: saved.assessment_tier || 'quiz',
          difficulty: saved.difficulty || 'medium',
          question_type: saved.question_type,
          question_text: saved.question_text.trim(),
          options: saved.question_type === 'mcq' ? saved.options : [],
          correct_answer: saved.correct_answer,
          marks: Number(saved.marks) || 1,
          status: 'active'
        });
        showToast('New question saved to bank');
      }

      setShowQuestionModal(false);
      resetQuestionForm();
      loadCourseData();
    } catch (err) {
      console.error('Error saving question:', err);
      showToast('Failed to save question', 'error');
    }
  };

  const resetQuestionForm = () => {
    setQuestionForm({
      topic: 'General',
      category: 'General',
      category_prefix: '',
      assessment_tier: 'quiz' as AssessmentCategory,
      difficulty: 'medium',
      question_type: 'mcq',
      question_text: '',
      options: ['', '', '', ''],
      correct_answer: '',
      marks: 1,
      status: 'active'
    });
    setIsEditing(false);
    setEditingQuestionId(null);
  };

  const handleEditClick = (q: QuestionBankItem) => {
    setIsEditing(true);
    setEditingQuestionId(q.id);
    const parsedOpts = parseOptions(q.options);
    const finalOpts = parsedOpts.length >= 4 
      ? parsedOpts.slice(0, 4) 
      : [...parsedOpts, ...Array(Math.max(0, 4 - parsedOpts.length)).fill('')];

    setQuestionForm({
      topic: q.topic || 'General',
      category: q.category || 'General',
      category_prefix: q.category_prefix || '',
      assessment_tier: q.assessment_tier || 'quiz',
      difficulty: q.difficulty || 'medium',
      question_type: q.question_type,
      question_text: q.question_text,
      options: finalOpts,
      correct_answer: q.correct_answer || '',
      marks: q.marks || 1,
      status: q.status
    });
    setShowQuestionModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this question?')) return;
    try {
      await db.deleteQuestionBankItem(id);
      showToast('Question deleted');
      loadCourseData();
    } catch (err) {
      console.error('Error deleting question:', err);
      showToast('Failed to delete question', 'error');
    }
  };

  const handleToggleStatus = async (q: QuestionBankItem) => {
    const newStatus = q.status === 'active' ? 'retired' : 'active';
    try {
      await db.updateQuestionBankItem(q.id, { status: newStatus });
      showToast(`Question marked as ${newStatus}`);
      loadCourseData();
    } catch (err) {
      console.error('Error toggling status:', err);
      showToast('Failed to update question status', 'error');
    }
  };

  const handleRetirePreviousTerm = async () => {
    if (!confirm(
      `⚠️ RETIRE PREVIOUS TERM POOL:\n\nThis will mark all currently active questions for ${selectedCourse?.code} as 'retired'.\n\nRetired questions remain in your historical archives and can be used for student practice, but won't be drawn for fresh exams. This eliminates leak risks across semesters.\n\nProceed?`
    )) return;

    try {
      const res = await db.retirePreviousTermQuestions(selectedCourseId);
      showToast(`Successfully retired ${res.length} questions from active pool.`, 'info');
      loadCourseData();
    } catch (err) {
      console.error('Error retiring pool:', err);
      showToast('Failed to retire questions', 'error');
    }
  };

  const handleExportCSV = () => {
    if (questions.length === 0) {
      showToast('No questions to export', 'error');
      return;
    }

    const content = exportQuestionsToCSVString(
      questions,
      `Institutional Exam Bank: ${selectedCourse?.code} - ${selectedCourse?.title} | Faculty Material`
    );
    const cleanCourse = (selectedCourse?.code || 'Course').trim().replace(/[\/\\]+/g, '-').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '');
    downloadCSVFile(content, `${cleanCourse}_Question_Bank_${new Date().toISOString().split('T')[0]}.csv`);
    showToast('Question Bank exported with audit watermark.', 'success');
  };

  const handleApplyBatchCategory = async () => {
    if (selectedQuestionIds.size === 0 || !selectedCourseId) return;
    const targetCat = courseCategories.find(c => c.prefix === batchTargetPrefix);
    const catName = targetCat ? targetCat.name : 'General';
    const catPrefix = targetCat ? targetCat.prefix : '';

    try {
      await db.bulkUpdateQuestionBankCategory(
        selectedCourseId,
        Array.from(selectedQuestionIds),
        catName,
        catPrefix
      );
      showToast(`Updated ${selectedQuestionIds.size} questions to [${catPrefix || 'General'}]`);
      setShowBatchCategoryModal(false);
      setSelectedQuestionIds(new Set());
      loadCourseData();
    } catch (err) {
      console.error('Error applying batch category:', err);
      showToast('Failed to update category', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl shadow-lg border flex items-center justify-between transition-all animate-in fade-in ${
          feedback.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
          feedback.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'error' ? <XCircle size={20} className="text-rose-600 shrink-0" /> :
             feedback.type === 'info' ? <Info size={20} className="text-blue-600 shrink-0" /> :
             <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />}
            <span className="font-semibold text-sm">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-sm opacity-60 hover:opacity-100 px-2 py-1">✕</button>
        </div>
      )}

      {/* Header & Course Switcher */}
      <BankHeader
        courses={courses}
        selectedCourseId={selectedCourseId}
        selectedCourse={selectedCourse}
        loadingCourses={loadingCourses}
        hasCourseAccess={hasCourseAccess}
        isCourseLead={isCourseLead}
        pendingRequestsCount={pendingRequests.length}
        onSelectCourse={(id) => setSelectedCourseId(id)}
        onOpenAddCourse={() => setShowAddCourseModal(true)}
        onOpenAccessManagement={() => setShowAccessManagementModal(true)}
      />

      {/* Empty State when no courses registered in system */}
      {courses.length === 0 && !loadingCourses && (
        <EmptyBankState
          type="no_courses"
          onOpenAddCourse={() => setShowAddCourseModal(true)}
        />
      )}

      {/* Restricted Access Screen */}
      {!hasCourseAccess && selectedCourse && (
        <RestrictedBankView
          course={selectedCourse}
          isUnassigned={(selectedCourse as any).isUnassigned}
          userPendingRequest={userPendingRequest}
          isClaimingCourse={isClaimingCourse}
          onClaimCourse={() => handleClaimCourse(selectedCourse.id)}
          onRequestAccess={() => setShowRequestAccessModal(true)}
        />
      )}

      {/* Full Access Screen (Questions list & controls) */}
      {hasCourseAccess && selectedCourse && (
        <>
          {/* Interactive Diagnostics Dashboard */}
          {bankStats && (
            <BankStatsDashboard
              stats={bankStats}
              courseCode={selectedCourse.code}
              statusFilter={statusFilter}
              difficultyFilter={difficultyFilter}
              onFilterClick={handleStatFilterClick}
            />
          )}

          {/* Action Toolbar & Filters */}
          <BankFiltersToolbar
            searchTerm={searchTerm}
            statusFilter={statusFilter}
            difficultyFilter={difficultyFilter}
            topicFilter={topicFilter}
            categoryFilter={categoryFilter}
            tierFilter={tierFilter}
            courseCategories={courseCategories}
            topics={bankStats?.topics || []}
            totalQuestionsCount={questions.length}
            filteredCount={filteredQuestions.length}
            isCourseLead={isCourseLead}
            loadingQuestions={loadingQuestions}
            onSearchChange={setSearchTerm}
            onStatusChange={setStatusFilter}
            onDifficultyChange={setDifficultyFilter}
            onTopicChange={setTopicFilter}
            onCategoryChange={setCategoryFilter}
            onTierChange={setTierFilter}
            onResetFilters={handleResetFilters}
            onOpenAddQuestion={() => {
              resetQuestionForm();
              setShowQuestionModal(true);
            }}
            onOpenImport={() => setShowImportModal(true)}
            onExportCSV={handleExportCSV}
            onOpenCategories={() => setShowCategoryModal(true)}
            onRetirePreviousTerm={handleRetirePreviousTerm}
            onOpenAccessManagement={() => setShowAccessManagementModal(true)}
            onRefresh={loadCourseData}
          />

          {/* Ergonomic Batch Actions Bar */}
          <BankBatchActionBar
            isAllPageSelected={paginatedQuestions.length > 0 && paginatedQuestions.every(q => selectedQuestionIds.has(q.id))}
            selectedCount={selectedQuestionIds.size}
            pageItemCount={paginatedQuestions.length}
            isCourseLead={isCourseLead}
            onSelectAllPage={handleSelectAllPage}
            onCreateQuizFromSelected={handleCreateQuizFromSelected}
            onOpenBatchCategory={() => {
              setBatchTargetPrefix('');
              setShowBatchCategoryModal(true);
            }}
            onBulkRetire={handleBulkRetire}
            onClearSelection={() => setSelectedQuestionIds(new Set())}
          />

          {/* Question List or Empty State */}
          {loadingQuestions ? (
            <div className="bg-white rounded-2xl p-16 text-center text-slate-500 shadow-sm border border-slate-100">
              <RefreshCw size={28} className="animate-spin mx-auto text-blue-600 mb-3" />
              <p className="font-semibold text-slate-700">Loading Question Repository...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <EmptyBankState
              type={questions.length === 0 ? 'no_questions' : 'no_filter_matches'}
              courseCode={selectedCourse.code}
              hasActiveFilters={questions.length > 0}
              onOpenAddQuestion={() => {
                resetQuestionForm();
                setShowQuestionModal(true);
              }}
              onOpenImport={() => setShowImportModal(true)}
              onResetFilters={handleResetFilters}
            />
          ) : (
            <div className="space-y-3">
              {paginatedQuestions.map((q, idx) => (
                <QuestionBankCard
                  key={q.id}
                  question={q}
                  index={(currentPage - 1) * itemsPerPage + idx + 1}
                  isSelected={selectedQuestionIds.has(q.id)}
                  courseCategories={courseCategories}
                  onToggleSelect={handleToggleSelectQuestion}
                  onEdit={handleEditClick}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              ))}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-100 shadow-sm flex-wrap gap-3">
                  <p className="text-xs text-slate-500 font-medium">
                    Showing <strong className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</strong> to{' '}
                    <strong className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredQuestions.length)}</strong> of{' '}
                    <strong className="text-slate-800">{filteredQuestions.length}</strong> questions
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className="rounded-xl border-slate-200 text-xs px-3"
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-bold text-slate-700 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className="rounded-xl border-slate-200 text-xs px-3"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* MODAL: Request Access */}
      {showRequestAccessModal && selectedCourse && (
        <Modal
          isOpen={showRequestAccessModal}
          onClose={() => setShowRequestAccessModal(false)}
          title={`Request Access to ${selectedCourse.code} Bank`}
        >
          <form onSubmit={handleSubmitAccessRequest} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              <strong>Academic Security Protocol:</strong> Access requests are reviewed by the Lead Tutor (<strong>{selectedCourse.assigned_lecturer_name || 'Department Head'}</strong>) or Admin. Approved access automatically expires after the selected window.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Academic Justification / Reason *
              </label>
              <Textarea
                required
                rows={3}
                placeholder="e.g. Internal moderation for Mid-Semester Exam, Co-teaching lab sections, or prerequisite curriculum alignment..."
                value={requestReason}
                onChange={(e) => setRequestReason(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Access Level
                </label>
                <select
                  value={requestPermission}
                  onChange={(e) => setRequestPermission(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="read_only">Examiner / Viewer (Draw & Moderate)</option>
                  <option value="contributor">Contributor (Submit Questions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Duration Window
                </label>
                <select
                  value={requestDuration}
                  onChange={(e) => setRequestDuration(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="3">3 Days (Quick Moderation)</option>
                  <option value="7">7 Days (Exam Period)</option>
                  <option value="14">14 Days (Two Weeks)</option>
                  <option value="30">30 Days (Full Month)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setShowRequestAccessModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmittingRequest} className="bg-blue-600 text-white">
                {isSubmittingRequest ? 'Submitting...' : 'Submit Access Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: Bank Access Management (Governance) */}
      {showAccessManagementModal && selectedCourse && (
        <BankAccessManagementModal
          isOpen={showAccessManagementModal}
          onClose={() => setShowAccessManagementModal(false)}
          courseId={selectedCourse.id}
          courseCode={selectedCourse.code}
          courseTitle={selectedCourse.title}
          assignedLecturerName={selectedCourse.assigned_lecturer_name}
          assignedLecturerEmail={selectedCourse.assigned_lecturer_email}
          assignedLecturerId={selectedCourse.assigned_lecturer_id || undefined}
          isAcademicOfficer={user?.role === 'admin' || user?.role === 'super_admin'}
          onChanged={async () => {
            await loadCourses();
            loadCourseData();
          }}
        />
      )}

      {/* MODAL: Question Editor */}
      {showQuestionModal && (
        <QuestionEditorModal
          isOpen={showQuestionModal}
          onClose={() => {
            setShowQuestionModal(false);
            resetQuestionForm();
          }}
          question={questionForm}
          isEditing={isEditing}
          bankMode={true}
          courseCode={selectedCourse?.code}
          courseCategories={courseCategories}
          onOpenCategoryManager={() => setShowCategoryModal(true)}
          onSave={handleSaveQuestion}
        />
      )}

      {/* MODAL: Universal Question Ingestion */}
      {showImportModal && selectedCourse && (
        <UniversalQuestionIngestionModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          courseCode={selectedCourse.code}
          courseTitle={selectedCourse.title}
          courseCategories={courseCategories}
          targetContext="question_bank"
          onImport={async (importedQuestions: ParsedIngestionQuestion[]) => {
            try {
              const parsedItems: Partial<QuestionBankItem>[] = importedQuestions.map(q => ({
                course_id: selectedCourseId,
                topic: q.topic || 'General',
                category: q.category || 'General',
                category_prefix: q.category_prefix || undefined,
                assessment_tier: q.assessment_tier || 'quiz',
                difficulty: q.difficulty || 'medium',
                question_type: q.question_type || 'mcq',
                question_text: q.question_text,
                options: q.options,
                correct_answer: q.correct_answer,
                marks: q.marks || 1,
                status: 'active'
              }));

              await db.bulkInsertQuestionBank(selectedCourseId, parsedItems);
              showToast(`Successfully imported ${parsedItems.length} questions into ${selectedCourse.code} bank!`, 'success');
              setShowImportModal(false);
              loadCourseData();
            } catch (err: any) {
              console.error('Failed to import questions to question bank:', err);
              showToast(err?.message || 'Failed to import questions. Please check your data.', 'error');
            }
          }}
        />
      )}

      {/* MODAL: Batch Set Assessment Category */}
      {showBatchCategoryModal && selectedCourse && (
        <Modal
          isOpen={showBatchCategoryModal}
          onClose={() => setShowBatchCategoryModal(false)}
          title={`Assign Category & Prefix (${selectedQuestionIds.size} Selected)`}
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Select an assessment category to tag all <strong className="text-slate-900">{selectedQuestionIds.size}</strong> selected questions in <strong className="text-slate-900">{selectedCourse.code}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Target Category
              </label>
              <select
                value={batchTargetPrefix}
                onChange={(e) => setBatchTargetPrefix(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">General / Clear Prefix</option>
                {courseCategories.map((c) => (
                  <option key={c.id} value={c.prefix}>
                    [{c.prefix}] {c.name}
                  </option>
                ))}
              </select>
            </div>

            {batchTargetPrefix && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                <span>Selected Category:</span>
                <span className={`px-2 py-0.5 rounded font-bold uppercase text-xs border ${
                  getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === batchTargetPrefix)?.color)
                }`}>
                  [{batchTargetPrefix}] {courseCategories.find(c => c.prefix === batchTargetPrefix)?.name}
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button variant="outline" onClick={() => setShowBatchCategoryModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApplyBatchCategory}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Apply to {selectedQuestionIds.size} Questions
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: Assessment Categories Management */}
      {showCategoryModal && selectedCourse && (
        <AssessmentCategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          courseId={selectedCourse.id}
          courseCode={selectedCourse.code}
          onCategoriesUpdated={(cats) => {
            setCourseCategories(cats);
            loadCourseData();
          }}
        />
      )}

      {/* MODAL: Register New Course */}
      {showAddCourseModal && user && (
        <AddCourseModal
          isOpen={showAddCourseModal}
          onClose={() => setShowAddCourseModal(false)}
          userId={user.id}
          userName={user.name || user.email}
          onCourseCreated={(newCourse) => {
            showToast(`Registered course ${newCourse.code}!`, 'success');
            loadCourses();
            setSelectedCourseId(newCourse.id);
          }}
        />
      )}
    </div>
  );
}
