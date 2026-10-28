import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Trash2, Edit2, Search, Plus, Upload, Download, Lock, Unlock, 
  CheckCircle2, XCircle, Clock, Archive, 
  RefreshCw, BookOpen, BarChart2, Check, Info, Tag
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { 
  db, Course, QuestionBankItem, QuestionBankAccessRequest, AssessmentCategoryItem, AssessmentCategory 
} from '../../lib/database';
import { parseOptions } from '../../utils/quizUtils';
import { useAuth } from '../../contexts/AuthContext';
import QuestionEditorModal, { QuestionForm } from '../../components/lecturer/QuestionEditorModal';
import AssessmentCategoryModal from '../../components/lecturer/AssessmentCategoryModal';
import UniversalQuestionIngestionModal from '../../components/lecturer/UniversalQuestionIngestionModal';
import { ParsedIngestionQuestion } from '../../utils/questionIngestionParsers';
import { getCategoryColorBadgeClasses, ASSESSMENT_CATEGORIES, getCategoryBadgeClasses, getCategoryShortLabel } from '../../utils/categoryUtils';
import { 
  exportQuestionsToCSVString, 
  downloadCSVFile 
} from '../../utils/csvQuestionUtils';

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
  const [bankStats, setBankStats] = useState<any>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'retired' | 'draft'>('active');
  const [topicFilter, setTopicFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<'all' | AssessmentCategory>('all');
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

  // Review requests modal (for Lead Lecturer / Admin)
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);

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

  // Import / Export modals & states
  const [showImportModal, setShowImportModal] = useState(false);

  // Add Course Modal
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseDepartment, setNewCourseDepartment] = useState('');
  const [assignSelf, setAssignSelf] = useState(true);

  // Toast feedback
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isClaimingCourse, setIsClaimingCourse] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

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
    return courses.find(c => c.id === selectedCourseId) || null;
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
        setBankStats(stats);
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
      // Check if user has a pending access request for this course
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

    // If user is lead or admin, check pending requests from other tutors
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
      if (searchTerm) {
        const matchText = q.question_text.toLowerCase().includes(searchTerm.toLowerCase());
        const matchTopic = q.topic.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = (q.category || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchPrefix = (q.category_prefix || '').toLowerCase().includes(searchTerm.toLowerCase());
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

  // Pagination
  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredQuestions.slice(start, start + itemsPerPage);
  }, [filteredQuestions, currentPage]);

  // Handle Submit Access Request
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

  // Handle Review Access Request
  const handleReviewRequest = async (decision: 'approved' | 'rejected') => {
    if (!reviewingRequestId || !user) return;

    try {
      await db.reviewBankAccessRequest(
        reviewingRequestId,
        user.id,
        decision,
        reviewNote.trim() || undefined
      );
      showToast(`Request ${decision === 'approved' ? 'approved' : 'rejected'}.`, 'success');
      setReviewingRequestId(null);
      setReviewNote('');
      setShowReviewModal(false);
      await loadCourses();
      loadCourseData();
    } catch (err) {
      console.error('Failed to review request:', err);
      showToast('Error processing review decision.', 'error');
    }
  };

  // Handle Save Question
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

  // 1-Click Retire Previous Term Pool
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

  // CSV Export
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

  // Batch Categorization Handler
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
      showToast(`Categorized ${selectedQuestionIds.size} questions as [${catPrefix || 'General'}]`, 'success');
      setShowBatchCategoryModal(false);
      setSelectedQuestionIds(new Set());
      loadCourseData();
    } catch (err) {
      console.error('Error batch categorizing:', err);
      showToast('Failed to categorize questions', 'error');
    }
  };

  // Add Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseTitle.trim()) {
      showToast('Course code and title are required', 'error');
      return;
    }

    try {
      const created = await db.createCourse({
        code: newCourseCode.trim(),
        title: newCourseTitle.trim(),
        department: newCourseDepartment.trim(),
        assigned_lecturer_id: assignSelf && user ? user.id : null
      });

      showToast(`Course ${created.code} registered!`);
      setShowAddCourseModal(false);
      setNewCourseCode('');
      setNewCourseTitle('');
      setNewCourseDepartment('');
      await loadCourses();
      setSelectedCourseId(created.id);
    } catch (err) {
      console.error('Error creating course:', err);
      showToast('Failed to create course. Code may already exist.', 'error');
    }
  };

  // Selection & Batch Action handlers
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
    if (!confirm(`Retire ${selectedQuestionIds.size} selected question(s)? They will be moved to the retired archive.`)) return;
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

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-4 rounded-xl shadow-lg border flex items-center justify-between transition-all animate-in fade-in ${
          feedback.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
          feedback.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-900' :
          'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? <XCircle size={20} className="text-red-600" /> :
             feedback.type === 'info' ? <Info size={20} className="text-blue-600" /> :
             <CheckCircle2 size={20} className="text-emerald-600" />}
            <span className="font-medium text-sm">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-sm opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Header & Course Switcher */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Institutional Question Bank</h1>
              <p className="text-sm text-gray-500">
                Course-bound question repository with pass-rate calibration & anti-leak safeguards
              </p>
            </div>
          </div>
        </div>

        {/* Course Selector & Add Course Button */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-[280px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Active Course Bank:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={loadingCourses || courses.length === 0}
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {courses.length === 0 ? (
                <option value="">No courses created yet</option>
              ) : (
                courses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title} {c.hasAccess ? '✓ (Access Granted)' : c.isUnassigned ? '⚡ (Unassigned — Claim)' : '🔒 (Restricted)'}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="pt-5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddCourseModal(true)}
              className="flex items-center gap-1.5 h-[38px]"
            >
              <Plus size={16} />
              <span>New Course</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Empty State when no courses registered yet */}
      {courses.length === 0 && !loadingCourses && (
        <Card className="p-12 text-center border-dashed border-2 border-gray-200 bg-white/60 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
            <BookOpen size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-xl font-bold text-gray-900">No Courses Registered Yet</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your institution's question repository is currently clean. Register your course code (e.g. <strong className="text-gray-700">INFO210, CS101, ENG201</strong>) to start building questions and conducting multi-session exams.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={() => setShowAddCourseModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
            >
              <Plus size={18} />
              <span>Create Your First Course</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Selected Course Metadata & Access Gating Banner */}
      {selectedCourse && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
              hasCourseAccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {selectedCourse.code.slice(0, 4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">{selectedCourse.code}: {selectedCourse.title}</h2>
                {hasCourseAccess ? (
                  <Badge variant="success" className="flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {isCourseLead ? 'Lead Tutor / Owner' : 'Delegated Access'}
                  </Badge>
                ) : (
                  <Badge variant="warning" className="flex items-center gap-1">
                    <Lock size={12} /> Restricted
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Department: <span className="font-medium text-gray-700">{selectedCourse.department || 'General'}</span> • 
                Assigned Lead: <span className="font-medium text-gray-700">{selectedCourse.assigned_lecturer_name || 'Unassigned'}</span>
                {(selectedCourse as any).delegationExpiresAt && (
                  <span className="text-blue-600 font-semibold ml-2">
                    (Access expires: {new Date((selectedCourse as any).delegationExpiresAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Pending Requests for Lead Tutor */}
          {isCourseLead && pendingRequests.length > 0 && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 p-3 rounded-xl">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold">
                <Clock size={18} className="text-amber-600 animate-pulse" />
                <span>{pendingRequests.length} Pending Access Request(s)</span>
              </div>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  setReviewingRequestId(pendingRequests[0].id);
                  setShowReviewModal(true);
                }}
              >
                Review Requests
              </Button>
            </div>
          )}
        </div>
      )}

      {/* RESTRICTED ACCESS SCREEN (If user is not assigned and has no active delegation) */}
      {!hasCourseAccess && selectedCourse && (
        <>
          {!selectedCourse.assigned_lecturer_id || (selectedCourse as any).isUnassigned ? (
            <Card className="border-blue-200 bg-gradient-to-b from-blue-50/80 to-indigo-50/30 p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                <BookOpen size={32} />
              </div>

              <div className="max-w-xl mx-auto space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 mb-1">
                  ⚡ Unassigned Academic Course
                </div>
                <h3 className="text-xl font-bold text-gray-900">{selectedCourse.code}: {selectedCourse.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  This course bank currently has <strong className="text-gray-900">no lead lecturer assigned</strong> for this semester. 
                  If you are teaching or coordinating <strong className="text-gray-900">{selectedCourse.code}</strong>, you can claim it now to unlock full access, author questions, or import exam sets.
                </p>
              </div>

              <div className="pt-2 flex flex-col items-center justify-center gap-2">
                <Button
                  onClick={() => handleClaimCourse(selectedCourse.id)}
                  disabled={isClaimingCourse}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  <span>{isClaimingCourse ? 'Assigning...' : 'Claim & Assign Myself as Lead Lecturer'}</span>
                </Button>
                <p className="text-xs text-gray-400 mt-1">
                  Assigns you as the active course owner with full question bank rights and access approval capabilities.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="border-amber-200 bg-amber-50/40 p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                <Lock size={32} />
              </div>

              <div className="max-w-xl mx-auto space-y-2">
                <h3 className="text-xl font-bold text-gray-900">Restricted Course Question Bank</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  You are not currently assigned as the lead lecturer for <strong className="text-gray-900">{selectedCourse.code} ({selectedCourse.title})</strong>. 
                  To maintain academic integrity and prevent exam question leakage across semester rotations, questions are locked to active course staff.
                </p>
              </div>

              {userPendingRequest ? (
                <div className="max-w-md mx-auto p-4 bg-white rounded-xl border border-amber-200 shadow-sm text-left">
                  <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-1">
                    <Clock size={16} />
                    <span>Access Request Pending Moderation</span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Submitted on {new Date(userPendingRequest.created_at).toLocaleDateString()} for{' '}
                    <strong className="text-gray-800">{userPendingRequest.duration_days} days</strong> ({userPendingRequest.access_level === 'read_only' ? 'Examiner / Viewer' : 'Contributor'}).
                  </p>
                  <p className="text-xs text-gray-500 italic mt-2 border-t pt-2">
                    "{userPendingRequest.reason}"
                  </p>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Awaiting approval by Lead Tutor ({selectedCourse.assigned_lecturer_name || 'Department Head'}).
                  </p>
                </div>
              ) : (
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    onClick={() => setShowRequestAccessModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl shadow-md inline-flex items-center gap-2"
                  >
                    <Unlock size={18} />
                    <span>Request Access to Bank</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleClaimCourse(selectedCourse.id)}
                    disabled={isClaimingCourse}
                    className="border-gray-300 text-gray-700 hover:bg-gray-100 font-medium px-4 py-2.5 rounded-xl inline-flex items-center gap-2 text-xs"
                    title="Take over this course for the new semester rotation"
                  >
                    <RefreshCw size={14} />
                    <span>{isClaimingCourse ? 'Updating...' : 'Semester Handover: Take Over Course'}</span>
                  </Button>
                </div>
              )}
              {!userPendingRequest && (
                <p className="text-xs text-gray-400">
                  Request access for moderation/co-teaching, or claim lead if this course has been rotated to you this semester.
                </p>
              )}
            </Card>
          )}
        </>
      )}

      {/* FULL ACCESS SCREEN (Questions list & controls) */}
      {hasCourseAccess && selectedCourse && (
        <>
          {/* Bank Summary Cards */}
          {bankStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-gray-500 font-semibold uppercase">Total In Bank</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{bankStats.total}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">All items in {selectedCourse.code}</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-emerald-600 font-semibold uppercase">Active Pool</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{bankStats.active}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Live exam draw pool</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-green-600 font-semibold uppercase">Easy (≥80%)</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{bankStats.easy}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">High pass rate</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-amber-600 font-semibold uppercase">Medium (40-79%)</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{bankStats.medium}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Standard difficulty</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-rose-600 font-semibold uppercase">Hard (&lt;40%)</p>
                <p className="text-2xl font-bold text-rose-600 mt-1">{bankStats.hard}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Discriminant items</p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xs text-blue-600 font-semibold uppercase">Auto-Calibrated</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{bankStats.calibratedCount}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">≥5 student attempts</p>
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <Button
                onClick={() => {
                  resetQuestionForm();
                  setShowQuestionModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Add Question</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1.5"
                title="Upload Word (.docx), Excel (.xlsx), Aiken (.txt), CSV or Smart Paste"
              >
                <Upload size={16} />
                <span>Import Questions</span>
              </Button>

              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="flex items-center gap-1.5"
              >
                <Download size={16} />
                <span>Export Bank</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowCategoryModal(true)}
                className="flex items-center gap-1.5 text-gray-700 hover:bg-gray-50 border-gray-300"
                title="Manage assessment categories and prefixes for this course"
              >
                <Tag size={16} className="text-blue-600" />
                <span>Categories ({courseCategories.length})</span>
              </Button>

              {/* 1-Click Retire Previous Term Pool */}
              {isCourseLead && (
                <Button
                  variant="outline"
                  onClick={handleRetirePreviousTerm}
                  className="text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1.5"
                  title="Archive questions used in previous terms so students cannot leak them"
                >
                  <Archive size={16} />
                  <span>Retire Previous Term Pool</span>
                </Button>
              )}
            </div>

            {/* Quick Refresh */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadCourseData}
              className="flex items-center gap-1 text-gray-500"
            >
              <RefreshCw size={14} className={loadingQuestions ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>

          {/* Filters & Search Row */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search text, topic, prefix..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories ({questions.length})</option>
                {courseCategories.map((c) => {
                  const count = bankStats?.categoryCounts?.[c.name]?.total || 0;
                  return (
                    <option key={c.id} value={c.prefix}>
                      [{c.prefix}] {c.name} ({count})
                    </option>
                  );
                })}
                <option value="uncategorized">General / Uncategorized</option>
              </select>
            </div>

            <div>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tiers</option>
                {ASSESSMENT_CATEGORIES.map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    {cat.shortLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active Pool Only (Ready for Exams)</option>
                <option value="retired">Retired / Archived (Past Terms)</option>
                <option value="draft">Drafts</option>
                <option value="all">All Statuses</option>
              </select>
            </div>

            <div>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Difficulties</option>
                <option value="easy">Easy (Pass Rate ≥ 80%)</option>
                <option value="medium">Medium (Pass Rate 40-79%)</option>
                <option value="hard">Hard (Pass Rate &lt; 40%)</option>
              </select>
            </div>

            <div>
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Topics</option>
                {bankStats?.topics?.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Select Bar / Batch Actions Toolbar */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer font-semibold text-gray-700 text-sm">
                <input
                  type="checkbox"
                  checked={paginatedQuestions.length > 0 && paginatedQuestions.every(q => selectedQuestionIds.has(q.id))}
                  onChange={handleSelectAllPage}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <span>Select All on Page ({paginatedQuestions.length})</span>
              </label>

              {selectedQuestionIds.size > 0 && (
                <span className="font-semibold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full text-xs border border-blue-200">
                  {selectedQuestionIds.size} selected
                </span>
              )}
            </div>

            {selectedQuestionIds.size > 0 ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={handleCreateQuizFromSelected}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-1.5 px-3 text-xs flex items-center gap-1.5 shadow-sm"
                  title="Create a quiz containing only the selected questions"
                >
                  <Plus size={14} />
                  <span>Create Quiz from Selected ({selectedQuestionIds.size})</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBatchTargetPrefix('');
                    setShowBatchCategoryModal(true);
                  }}
                  className="text-blue-700 border-blue-300 hover:bg-blue-50 py-1.5 px-3 text-xs flex items-center gap-1.5"
                  title="Assign selected questions to an assessment category and prefix"
                >
                  <Tag size={14} />
                  <span>Set Category ({selectedQuestionIds.size})</span>
                </Button>

                {isCourseLead && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkRetire}
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 py-1.5 px-3 text-xs flex items-center gap-1.5"
                    title="Archive selected questions from live exam pools"
                  >
                    <Archive size={14} />
                    <span>Retire Selected</span>
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedQuestionIds(new Set())}
                  className="text-gray-500 hover:text-gray-700 py-1.5 px-2.5 text-xs"
                >
                  Clear Selection
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Tip: Check questions to create a customized quiz or retire them in batch.
              </p>
            )}
          </div>

          {/* Question List */}
          {loadingQuestions ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-500">
              <RefreshCw size={24} className="animate-spin mx-auto text-blue-600 mb-2" />
              <p>Loading Question Bank...</p>
            </div>
          ) : paginatedQuestions.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
              <h4 className="text-base font-semibold text-gray-800">No questions found in this view</h4>
              <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                {searchTerm || statusFilter !== 'all' || difficultyFilter !== 'all' || topicFilter !== 'all' || categoryFilter !== 'all' || tierFilter !== 'all'
                  ? 'Try clearing your filters or search terms.'
                  : `Add questions or import a CSV to populate the question bank for ${selectedCourse.code}.`}
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => setShowQuestionModal(true)} size="sm" className="bg-blue-600 text-white">
                  Add First Question
                </Button>
                <Button onClick={() => setShowImportModal(true)} variant="outline" size="sm">
                  Import / Ingest Questions
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginatedQuestions.map((q, idx) => {
                const parsedOptions: string[] = parseOptions(q.options);

                const answeredCount = q.times_answered || 0;
                const correctCount = q.times_correct || 0;
                const isCalibrated = answeredCount >= 5;
                const isSelected = selectedQuestionIds.has(q.id);

                return (
                  <div 
                    key={q.id} 
                    className={`bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${
                      isSelected 
                        ? 'border-blue-400 bg-blue-50/20 ring-2 ring-blue-400/30' 
                        : q.status === 'retired' 
                          ? 'border-gray-200 bg-gray-50/50 opacity-80' 
                          : 'border-gray-100'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      {/* Left: Badges & Content */}
                      <div className="space-y-2.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectQuestion(q.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer mr-1"
                            title="Select question"
                          />

                          <span className="text-xs font-bold text-gray-400">
                            #{(currentPage - 1) * itemsPerPage + idx + 1}
                          </span>

                          {/* Topic Badge */}
                          <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 font-semibold">
                            {q.topic || 'General'}
                          </Badge>

                          {/* Assessment Category & Prefix Badge */}
                          {(q.category_prefix || (q.category && q.category !== 'General')) && (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${
                              getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === q.category_prefix)?.color)
                            }`}>
                              [{q.category_prefix || q.category}] {q.category && q.category !== q.category_prefix ? q.category : ''}
                            </span>
                          )}

                          {/* Assessment Classification Tier Badge */}
                          <span className={`px-2 py-0.5 rounded-md text-xs border ${getCategoryBadgeClasses(q.assessment_tier || 'quiz')}`}>
                            {getCategoryShortLabel(q.assessment_tier || 'quiz')}
                          </span>

                          {/* Empirical Difficulty Badge */}
                          {q.difficulty === 'easy' && (
                            <Badge variant="success" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              🟢 Easy {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
                            </Badge>
                          )}
                          {q.difficulty === 'medium' && (
                            <Badge variant="warning" className="bg-amber-50 text-amber-700 border-amber-200">
                              🟡 Medium {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
                            </Badge>
                          )}
                          {q.difficulty === 'hard' && (
                            <Badge variant="danger" className="bg-rose-50 text-rose-700 border-rose-200">
                              🔴 Hard {isCalibrated ? `(${q.empirical_pass_rate}%)` : ''}
                            </Badge>
                          )}

                          {/* Status Badge */}
                          {q.status === 'active' ? (
                            <Badge variant="success" className="text-[11px]">Active Pool</Badge>
                          ) : q.status === 'retired' ? (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600 text-[11px]">Retired (Past Term)</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-[11px]">Draft</Badge>
                          )}

                          {/* Marks Badge */}
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {q.marks} {q.marks === 1 ? 'mark' : 'marks'}
                          </span>

                          {/* Type */}
                          <span className="text-xs text-gray-400 uppercase tracking-wider">
                            {q.question_type.toUpperCase()}
                          </span>
                        </div>

                        {/* Question Text */}
                        <p className="text-base font-semibold text-gray-900 leading-snug">
                          {q.question_text}
                        </p>

                        {/* MCQ Options Display */}
                        {q.question_type === 'mcq' && Array.isArray(parsedOptions) && parsedOptions.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                            {parsedOptions.map((opt, optIdx) => {
                              const letter = String.fromCharCode(65 + optIdx);
                              const isCorrect = q.correct_answer === letter || q.correct_answer === opt;
                              return (
                                <div
                                  key={optIdx}
                                  className={`text-xs p-2.5 rounded-xl border flex items-center gap-2 ${
                                    isCorrect 
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium' 
                                      : 'bg-gray-50 border-gray-200 text-gray-700'
                                  }`}
                                >
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                                    isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    {letter}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                  {isCorrect && <Check size={14} className="text-emerald-600" />}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* True / False Display */}
                        {q.question_type === 'true_false' && (
                          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-xl inline-block">
                            Correct Answer: <strong className="text-emerald-700 uppercase">{q.correct_answer}</strong>
                          </div>
                        )}

                        {/* Answer Statistics Bar */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 pt-1">
                          <span className="flex items-center gap-1 font-medium">
                            <BarChart2 size={13} className="text-gray-400" />
                            {isCalibrated ? (
                              <span>
                                Pass rate: <strong className="text-gray-800">{q.empirical_pass_rate}%</strong> ({correctCount}/{answeredCount} correct)
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">
                                Calibrating pass rate ({answeredCount}/5 test responses)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex lg:flex-col items-center gap-2 justify-end pt-2 lg:pt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClick(q)}
                          className="flex items-center gap-1 text-xs"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(q)}
                          className={`text-xs ${
                            q.status === 'active' 
                              ? 'text-gray-600 hover:text-amber-700' 
                              : 'text-emerald-700 hover:text-emerald-800'
                          }`}
                        >
                          {q.status === 'active' ? 'Retire' : 'Activate'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(q.id)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 text-xs"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs text-gray-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredQuestions.length)} of {filteredQuestions.length} questions
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <span className="text-xs font-semibold px-2">Page {currentPage} of {totalPages}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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

      {/* MODAL: Request Access to Question Bank */}
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
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Access Level
                </label>
                <select
                  value={requestPermission}
                  onChange={(e) => setRequestPermission(e.target.value as any)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="read_only">Examiner / Viewer (Draw & Moderate)</option>
                  <option value="contributor">Contributor (Submit Questions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Duration Window
                </label>
                <select
                  value={requestDuration}
                  onChange={(e) => setRequestDuration(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* MODAL: Review Pending Requests (For Lead Tutor / Admin) */}
      {showReviewModal && reviewingRequestId && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setReviewingRequestId(null);
          }}
          title="Review Bank Access Request"
        >
          {(() => {
            const req = pendingRequests.find(r => r.id === reviewingRequestId);
            if (!req) return <p className="text-sm text-gray-500">No request selected.</p>;

            return (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{req.requester_name}</p>
                      <p className="text-xs text-gray-500">{req.requester_email}</p>
                    </div>
                    <Badge variant="warning">{req.duration_days} Days ({req.access_level})</Badge>
                  </div>
                  <div className="pt-2 border-t text-xs text-gray-700">
                    <span className="font-semibold block text-gray-500 mb-0.5">Academic Justification:</span>
                    <p className="italic bg-white p-2.5 rounded-lg border border-gray-200">
                      "{req.reason}"
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Reviewer Notes (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Approved for internal moderation window only."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleReviewRequest('rejected')}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    Reject Access
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => handleReviewRequest('approved')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Approve Access ({req.duration_days} Days)
                  </Button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* MODAL: Add / Edit Question */}
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
            <p className="text-sm text-gray-600">
              Select an assessment category to tag all <strong className="text-gray-900">{selectedQuestionIds.size}</strong> selected questions in <strong className="text-gray-900">{selectedCourse.code}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Target Category
              </label>
              <select
                value={batchTargetPrefix}
                onChange={(e) => setBatchTargetPrefix(e.target.value)}
                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500"
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

      {/* MODAL: Add New Course */}
      {showAddCourseModal && (
        <Modal
          isOpen={showAddCourseModal}
          onClose={() => setShowAddCourseModal(false)}
          title="Register New Institutional Course"
        >
          <form onSubmit={handleCreateCourse} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Course Code *
              </label>
              <Input
                required
                placeholder="e.g. CS101, INFO205, MATH110"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value.toUpperCase())}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Course Title *
              </label>
              <Input
                required
                placeholder="e.g. Introduction to Programming and Algorithmic Thinking"
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Department (Optional)
              </label>
              <Input
                placeholder="e.g. Computer Science, Information Systems"
                value={newCourseDepartment}
                onChange={(e) => setNewCourseDepartment(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={assignSelf}
                  onChange={(e) => setAssignSelf(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <span className="text-gray-700">Assign myself ({user?.name}) as Lead Lecturer for this course</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <Button type="button" variant="outline" onClick={() => setShowAddCourseModal(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white">
                Register Course
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
