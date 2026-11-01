import React, { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Eye, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { db, Course, Quiz, AssessmentCategory, TopicDrawRule, AssessmentCategoryItem } from '../../lib/database';
import { parseOptions } from '../../utils/quizUtils';
import { useAuth } from '../../contexts/AuthContext';
import { parseTopicDrawRules } from '../../utils/categoryUtils';
import QuizSessionManagerModal from '../../components/lecturer/QuizSessionManagerModal';
import QuestionEditorModal from '../../components/lecturer/QuestionEditorModal';
import AssessmentCategoryModal from '../../components/lecturer/AssessmentCategoryModal';
import QuizPreviewModal from '../../components/lecturer/QuizPreviewModal';
import UniversalQuestionIngestionModal from '../../components/lecturer/UniversalQuestionIngestionModal';
import { ParsedIngestionQuestion, getCleanTemplateFilename } from '../../utils/questionIngestionParsers';
import { 
  generateQuestionCSVTemplate, 
  exportQuestionsToCSVString, 
  downloadCSVFile 
} from '../../utils/csvQuestionUtils';

import { WizardStep, QuestionForm } from './components/create-quiz/types';
import { StepperHeader } from './components/create-quiz/StepperHeader';
import { ExamBasicsStep } from './components/create-quiz/ExamBasicsStep';
import { QuestionsStrategyStep } from './components/create-quiz/QuestionsStrategyStep';
import { SecurityProctoringStep } from './components/create-quiz/SecurityProctoringStep';
import { ExamReviewChecklistStep } from './components/create-quiz/ExamReviewChecklistStep';
import { AddCourseModal } from './components/create-quiz/AddCourseModal';
import { BankQuestionPickerModal } from './components/create-quiz/BankQuestionPickerModal';

export default function CreateQuiz() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  const navigate = useNavigate();
  const { user } = useAuth();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [lastAutoSaved, setLastAutoSaved] = useState<Date | null>(null);
  const [draftRestoredBanner, setDraftRestoredBanner] = useState(false);

  // Step 1: Basics & Identity
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AssessmentCategory>('quiz');
  const [categoryPrefix, setCategoryPrefix] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('60');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [courseCategories, setCourseCategories] = useState<AssessmentCategoryItem[]>([]);

  // Step 2: Questions Strategy
  const [isDynamicDraw, setIsDynamicDraw] = useState(false);
  const [poolMode, setPoolMode] = useState<'flat' | 'stratified'>('flat');
  const [poolCourseIds, setPoolCourseIds] = useState<string[]>([]);
  const [selectedPoolCategories, setSelectedPoolCategories] = useState<string[]>([]);
  const [selectedPoolTiers, setSelectedPoolTiers] = useState<AssessmentCategory[]>([]);
  const [topicRules, setTopicRules] = useState<Record<string, number>>({});
  const [drawQuestionCount, setDrawQuestionCount] = useState('25');
  const [saveToQuestionBank, setSaveToQuestionBank] = useState(true);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [bankStats, setBankStats] = useState<any>(null);

  // Step 3: Security & Proctoring
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeOptions, setRandomizeOptions] = useState(true);
  const [passingScore, setPassingScore] = useState('50');
  const [enableScreenRecording, setEnableScreenRecording] = useState(false);
  const [enableTabMonitoring, setEnableTabMonitoring] = useState(true);
  const [enableCopyPastePrevention, setEnableCopyPastePrevention] = useState(true);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [requireSeb, setRequireSeb] = useState(false);
  const [enableCameraProctoring, setEnableCameraProctoring] = useState(false);

  // Multi-session & Moderation
  const [hasMultipleSessions, setHasMultipleSessions] = useState(false);
  const [currentQuizObj, setCurrentQuizObj] = useState<Quiz | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState<string>('');

  // Modals state
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBankPickerModal, setShowBankPickerModal] = useState(false);

  // Question editing state
  const [currentQuestion, setCurrentQuestion] = useState<QuestionForm>({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // Bank picker data
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [loadingBankQuestions, setLoadingBankQuestions] = useState(false);

  const selectedCourse = useMemo(() => courses.find(c => c.id === selectedCourseId), [courses, selectedCourseId]);

  // Dynamic capacity calculation
  const activeQuestionsInPool = useMemo(() => {
    if (!bankStats) return 0;
    if (selectedPoolCategories.length === 0) {
      return Number(bankStats.active) || 0;
    }
    let total = 0;
    const catCounts = bankStats.categoryCounts || {};
    selectedPoolCategories.forEach((pref) => {
      if (pref === 'uncategorized') {
        total += catCounts['General']?.active || 0;
      } else {
        const catObj = courseCategories.find(c => c.prefix === pref);
        const name = catObj ? catObj.name : pref;
        total += catCounts[name]?.active || 0;
      }
    });
    return total;
  }, [bankStats, selectedPoolCategories, courseCategories]);

  // Total marks calculation
  const totalMarks = useMemo(() => {
    if (isDynamicDraw) {
      if (poolMode === 'stratified') {
        return Object.values(topicRules).reduce((sum, count) => sum + (Number(count) || 0), 0);
      }
      return parseInt(drawQuestionCount, 10) || 0;
    }
    return questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
  }, [isDynamicDraw, poolMode, topicRules, drawQuestionCount, questions]);

  // Step transition helper
  const handleStepChange = (targetStep: WizardStep) => {
    setCurrentStep(targetStep);
    if (targetStep > maxStepReached) {
      setMaxStepReached(targetStep);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load courses
  const loadCourses = async () => {
    if (user) {
      try {
        const data = await db.getCourses(user.id);
        setCourses(data as Course[]);
      } catch (err) {
        console.error('Error fetching courses in CreateQuiz:', err);
      }
    }
  };

  useEffect(() => {
    loadCourses();
  }, [user]);

  // Load question bank stats and categories when course is selected
  useEffect(() => {
    if (selectedCourseId) {
      db.getQuestionBankStats(selectedCourseId).then((stats: any) => {
        setBankStats(stats);
        if (!isEditMode && stats && stats.active > 0) {
          setDrawQuestionCount(prev => {
            const current = parseInt(prev, 10);
            if (!current || current > stats.active) {
              return String(Math.min(25, stats.active));
            }
            return prev;
          });
          if (Array.isArray(stats.topics)) {
            setTopicRules(prev => {
              const next = { ...prev };
              for (const t of stats.topics) {
                if (next[t] === undefined) {
                  next[t] = 0;
                }
              }
              return next;
            });
          }
        }
      }).catch((err: any) => console.error('Error fetching course bank stats:', err));

      db.getAssessmentCategories(selectedCourseId).then((cats: any) => {
        setCourseCategories(cats || []);
      }).catch((err: any) => console.error('Error fetching course categories:', err));
    } else {
      setBankStats(null);
      setCourseCategories([]);
    }
  }, [selectedCourseId]);

  // Check for preloaded questions from Question Bank
  useEffect(() => {
    if (!id) {
      const preloaded = sessionStorage.getItem('preloaded_quiz_questions');
      if (preloaded) {
        try {
          const parsed = JSON.parse(preloaded);
          if (parsed.course_id) {
            setSelectedCourseId(parsed.course_id);
          }
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            const formatted: QuestionForm[] = parsed.questions.map((item: any) => {
              const parsedOpts = parseOptions(item.options);
              const opts = parsedOpts.length >= 4 
                ? parsedOpts.slice(0, 4) 
                : [...parsedOpts, ...Array(Math.max(0, 4 - parsedOpts.length)).fill('')];
              return {
                question_text: item.question_text,
                question_type: item.question_type as 'mcq' | 'true_false' | 'essay',
                options: opts,
                correct_answer: item.correct_answer || '',
                marks: item.marks || 1
              };
            });
            setQuestions(formatted);
          }
        } catch (e) {
          console.error('Failed to parse preloaded questions:', e);
        } finally {
          sessionStorage.removeItem('preloaded_quiz_questions');
        }
      }
    }
  }, [id]);

  // Load quiz data if in edit mode
  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      loadQuizData(id);
    } else {
      // Check for saved local draft for new quizzes
      const draftKey = `create_quiz_draft_${user?.id || 'default'}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const d = JSON.parse(savedDraft);
          if (d.title || d.course_id || (d.questions && d.questions.length > 0)) {
            if (d.course_id) setSelectedCourseId(d.course_id);
            if (d.title) setTitle(d.title);
            if (d.category) setCategory(d.category);
            if (d.category_prefix) setCategoryPrefix(d.category_prefix);
            if (d.subject) setSubject(d.subject);
            if (d.description) setDescription(d.description);
            if (d.duration) setDuration(d.duration);
            if (d.deadlineDate) setDeadlineDate(d.deadlineDate);
            if (d.deadlineTime) setDeadlineTime(d.deadlineTime);
            if (d.isDynamicDraw !== undefined) setIsDynamicDraw(d.isDynamicDraw);
            if (d.drawQuestionCount) setDrawQuestionCount(d.drawQuestionCount);
            if (d.questions && Array.isArray(d.questions)) setQuestions(d.questions);
            if (d.randomizeQuestions !== undefined) setRandomizeQuestions(d.randomizeQuestions);
            if (d.randomizeOptions !== undefined) setRandomizeOptions(d.randomizeOptions);
            setDraftRestoredBanner(true);
          }
        } catch (e) {
          console.warn('Failed to parse saved draft:', e);
        }
      }
    }
  }, [id, user?.id]);

  // Auto-save draft debounced
  const draftTimerRef = useRef<any>(null);
  useEffect(() => {
    if (isEditMode || !user) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);

    draftTimerRef.current = setTimeout(() => {
      const draftKey = `create_quiz_draft_${user.id}`;
      const draftData = {
        course_id: selectedCourseId,
        title,
        category,
        category_prefix: categoryPrefix,
        subject,
        description,
        duration,
        deadlineDate,
        deadlineTime,
        isDynamicDraw,
        drawQuestionCount,
        questions,
        randomizeQuestions,
        randomizeOptions,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
      setLastAutoSaved(new Date());
    }, 2500);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    isEditMode, user, selectedCourseId, title, category, categoryPrefix, 
    subject, description, duration, deadlineDate, deadlineTime, 
    isDynamicDraw, drawQuestionCount, questions, randomizeQuestions, randomizeOptions
  ]);

  const clearDraft = () => {
    if (user) {
      localStorage.removeItem(`create_quiz_draft_${user.id}`);
    }
    setDraftRestoredBanner(false);
  };

  const loadQuizData = async (quizId: string) => {
    try {
      setLoading(true);
      const quiz = await db.getQuiz(quizId);
      if (!quiz) {
        alert('Quiz not found');
        navigate('/lecturer/my-quizzes');
        return;
      }

      setCurrentQuizObj(quiz as Quiz);

      if (quiz.category) setCategory(quiz.category as AssessmentCategory);
      if (quiz.category_prefix) setCategoryPrefix(quiz.category_prefix);
      if (quiz.bank_category_filter) {
        if (quiz.bank_category_filter === 'all') {
          setSelectedPoolCategories([]);
        } else {
          const list = String(quiz.bank_category_filter)
            .split(',')
            .map((c: string) => c.trim())
            .filter(Boolean);
          setSelectedPoolCategories(list);
        }
      }
      if (quiz.topic_draw_rules) {
        const parsedRules = parseTopicDrawRules(quiz.topic_draw_rules);
        if (parsedRules.length > 0) {
          setPoolMode('stratified');
          const ruleMap: Record<string, number> = {};
          parsedRules.forEach((r) => {
            ruleMap[r.topic] = r.count;
          });
          setTopicRules(ruleMap);
        }
      }
      setTitle(quiz.title || '');
      setDescription(quiz.description || '');
      setSubject(quiz.subject || '');
      setDuration(quiz.duration_minutes ? quiz.duration_minutes.toString() : '60');
      if (quiz.course_id) setSelectedCourseId(quiz.course_id);
      setIsDynamicDraw(quiz.is_dynamic_draw || false);
      setDrawQuestionCount(quiz.draw_question_count ? quiz.draw_question_count.toString() : '25');
      setHasMultipleSessions(quiz.has_multiple_sessions || false);
      setRandomizeQuestions(quiz.randomize_questions || false);
      setRandomizeOptions(quiz.randomize_options || false);
      setShowResultsImmediately(quiz.show_results_immediately !== false);
      setAllowReview(quiz.allow_review !== false);
      setRequireSeb(quiz.require_seb || false);
      setEnableCameraProctoring(quiz.enable_camera_proctoring || false);
      setEnableScreenRecording(quiz.enable_screen_recording || false);
      setEnableTabMonitoring(quiz.enable_tab_monitoring !== false);
      setEnableCopyPastePrevention(quiz.enable_copy_paste_prevention !== false);

      if (quiz.deadline) {
        const dl = new Date(quiz.deadline);
        setDeadlineDate(dl.toISOString().split('T')[0]);
        setDeadlineTime(dl.toTimeString().slice(0, 5));
      }

      // Load questions
      const quizQuestions = await db.getQuestions(quizId);
      const formattedQuestions: QuestionForm[] = quizQuestions.map((q: any) => {
        let options: string[] = ['', '', '', ''];
        if (q.question_type === 'mcq') {
          const parsed = parseOptions(q.options);
          options = parsed.length >= 4
            ? parsed.slice(0, 4)
            : [...parsed, ...Array(Math.max(0, 4 - parsed.length)).fill('')];
        } else if (q.question_type === 'true_false') {
          options = ['True', 'False', '', ''];
        }

        return {
          id: q.id,
          question_text: q.question_text || '',
          question_type: (q.question_type || 'mcq') as 'mcq' | 'true_false' | 'essay',
          options: options,
          correct_answer: q.correct_answer || '',
          marks: q.marks || 1
        };
      });
      setQuestions(formattedQuestions);

      // Fetch moderation feedback if quiz was rejected
      if (quiz.status === 'rejected') {
        try {
          const moderations = await db.getQuizModerations(quizId);
          if (moderations && moderations.length > 0) {
            const latest = moderations.find((m: any) => m.status === 'rejected') || moderations[0];
            if (latest?.notes) {
              setRejectionFeedback(latest.notes);
            }
          }
        } catch (mErr) {
          console.warn('Failed to fetch moderations for rejected quiz:', mErr);
        }
      }
    } catch (error) {
      console.error('Error loading quiz:', error);
      alert('Error loading quiz data');
    } finally {
      setLoading(false);
    }
  };

  // Fixed Question Handlers
  const handleEditQuestion = (index: number) => {
    const q = questions[index];
    const parsedOpts = parseOptions(q?.options);
    const opts = parsedOpts.length >= 4
      ? parsedOpts.slice(0, 4)
      : [...parsedOpts, ...Array(Math.max(0, 4 - parsedOpts.length)).fill('')];

    setCurrentQuestion({
      ...q,
      options: opts
    });
    setEditIndex(index);
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleOpenBankPicker = async () => {
    if (!selectedCourseId) {
      alert('Please select an Institutional Course first.');
      return;
    }
    setShowBankPickerModal(true);
    setLoadingBankQuestions(true);
    try {
      const data = await db.getQuestionBankQuestions(selectedCourseId, { status: 'active' });
      setBankQuestions(data || []);
    } catch (err) {
      console.error('Failed to load bank questions:', err);
    } finally {
      setLoadingBankQuestions(false);
    }
  };

  const downloadQuestionTemplate = () => {
    const template = generateQuestionCSVTemplate(selectedCourse?.code);
    downloadCSVFile(template, getCleanTemplateFilename('csv', selectedCourse?.code));
  };

  const exportQuestionsToCSV = () => {
    if (questions.length === 0) {
      alert('No questions to export');
      return;
    }
    const content = exportQuestionsToCSVString(
      questions,
      `${title || 'Quiz'} Questions (${selectedCourse?.code || 'Course'})`
    );
    const cleanCourse = selectedCourse?.code 
      ? `${selectedCourse.code.trim().replace(/[\/\\]+/g, '-').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '')}_` 
      : '';
    const cleanTitle = (title || 'Quiz').trim().replace(/[\/\\]+/g, '-').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${cleanCourse}${cleanTitle}_Questions.csv`;
    downloadCSVFile(content, filename);
  };

  // Final Form Submission
  const handleSubmit = async (e?: FormEvent | boolean, submitForReview: boolean = false) => {
    if (typeof e === 'object' && e !== null && 'preventDefault' in e) {
      e.preventDefault();
    } else if (typeof e === 'boolean') {
      submitForReview = e;
    }
    setValidationError('');

    if (!title.trim()) {
      setValidationError('Quiz title is required');
      setCurrentStep(1);
      return;
    }

    if (isDynamicDraw) {
      if (!selectedCourseId) {
        setValidationError('Please select an Institutional Course for the Dynamic Question Bank Draw');
        setCurrentStep(1);
        return;
      }
      const activeCount = bankStats ? Number(bankStats.active) : 0;
      if (activeCount === 0) {
        setValidationError('The question bank for this course has 0 active questions. Please add questions to the bank or import questions first.');
        setCurrentStep(2);
        return;
      }

      if (poolMode === 'stratified') {
        const formattedRules: TopicDrawRule[] = Object.entries(topicRules)
          .filter(([_, count]) => count > 0)
          .map(([t, count]) => ({ topic: t, count }));

        const totalStratified = formattedRules.reduce((sum, r) => sum + r.count, 0);
        if (formattedRules.length === 0 || totalStratified < 1) {
          setValidationError('Please allocate at least 1 question in the Topic Blueprint matrix for stratified draw.');
          setCurrentStep(2);
          return;
        }

        for (const rule of formattedRules) {
          const active = bankStats?.topicCounts?.[rule.topic]?.active ?? 0;
          if (rule.count > active) {
            setValidationError(`Topic "${rule.topic}" has only ${active} active questions, but ${rule.count} was specified.`);
            setCurrentStep(2);
            return;
          }
        }
      } else {
        const count = parseInt(drawQuestionCount, 10);
        if (!count || count < 1) {
          setValidationError('Please specify how many questions to draw per student (at least 1)');
          setCurrentStep(2);
          return;
        }
        if (count > activeCount) {
          setValidationError(`Cannot draw ${count} questions: only ${activeCount} active questions are available in the bank.`);
          setCurrentStep(2);
          return;
        }
      }
    } else {
      if (questions.length === 0) {
        setValidationError('At least one question is required');
        setCurrentStep(2);
        return;
      }
    }

    const durationNum = parseInt(duration, 10);
    if (!durationNum || durationNum < 1) {
      setValidationError('Duration must be at least 1 minute');
      setCurrentStep(1);
      return;
    }

    setLoading(true);

    try {
      if (!user) {
        setValidationError('You must be logged in to create a quiz');
        return;
      }

      const formattedTopicRules: TopicDrawRule[] = (isDynamicDraw && poolMode === 'stratified')
        ? Object.entries(topicRules)
            .filter(([_, count]) => count > 0)
            .map(([t, count]) => ({ topic: t, count }))
        : [];

      const effectiveDrawCount = isDynamicDraw
        ? (poolMode === 'stratified'
            ? formattedTopicRules.reduce((sum, r) => sum + r.count, 0)
            : (parseInt(drawQuestionCount, 10) || 25))
        : 0;

      const calcTotalMarks = isDynamicDraw 
        ? effectiveDrawCount * 1
        : questions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

      const deadlineCombined = deadlineDate 
        ? `${deadlineDate}T${deadlineTime || '23:59'}:00` 
        : null;

      const quizPayload = {
        course_id: selectedCourseId || null,
        title: title.trim(),
        description: description.trim(),
        subject: subject.trim(),
        duration_minutes: durationNum,
        total_marks: calcTotalMarks,
        category,
        category_prefix: categoryPrefix ? categoryPrefix.toUpperCase().trim() : null,
        bank_category_filter: selectedPoolCategories.length === 0 ? 'all' : selectedPoolCategories.join(','),
        topic_draw_rules: formattedTopicRules,
        status: submitForReview ? 'pending_approval' : 'draft',
        deadline: deadlineCombined ? new Date(deadlineCombined).toISOString() : null,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        show_results_immediately: showResultsImmediately,
        allow_review: allowReview,
        require_seb: requireSeb,
        enable_camera_proctoring: enableCameraProctoring,
        enable_screen_recording: enableScreenRecording,
        enable_tab_monitoring: enableTabMonitoring,
        enable_copy_paste_prevention: enableCopyPastePrevention,
        is_dynamic_draw: isDynamicDraw,
        draw_question_count: effectiveDrawCount,
        has_multiple_sessions: hasMultipleSessions,
        pool_course_ids: poolCourseIds,
      };

      if (isEditMode && id) {
        await db.updateQuiz(id, quizPayload);

        if (!isDynamicDraw) {
          const existingQuestions = await db.getQuestions(id);
          await Promise.all(existingQuestions.map((q: any) => db.deleteQuestion(q.id)));

          const questionsToInsert = questions.map(q => ({
            quiz_id: id,
            lecturer_id: user.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.question_type === 'mcq' ? JSON.stringify(q.options) : '[]',
            correct_answer: q.correct_answer,
            marks: q.marks,
          }));

          await Promise.all(questionsToInsert.map(q => db.createQuestion(q)));

          if (selectedCourseId && saveToQuestionBank) {
            try {
              const activeCatObj = courseCategories.find(c => c.prefix === categoryPrefix);
              const defaultCatName = activeCatObj ? activeCatObj.name : 'General';
              await db.syncQuizQuestionsToBank(selectedCourseId, questions, defaultCatName, categoryPrefix || undefined);
            } catch (bankErr) {
              console.warn('Note on question bank sync:', bankErr);
            }
          }
        }
      } else {
        const quiz = await db.createQuiz({
          lecturer_id: user.id,
          ...quizPayload,
        });

        if (!isDynamicDraw) {
          const questionsToInsert = questions.map(q => ({
            quiz_id: quiz.id,
            lecturer_id: user.id,
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.question_type === 'mcq' ? JSON.stringify(q.options) : '[]',
            correct_answer: q.correct_answer,
            marks: q.marks,
          }));

          await Promise.all(questionsToInsert.map(q => db.createQuestion(q)));

          if (selectedCourseId && saveToQuestionBank) {
            try {
              const activeCatObj = courseCategories.find(c => c.prefix === categoryPrefix);
              const defaultCatName = activeCatObj ? activeCatObj.name : 'General';
              await db.syncQuizQuestionsToBank(selectedCourseId, questions, defaultCatName, categoryPrefix || undefined);
            } catch (bankErr) {
              console.warn('Note on question bank sync:', bankErr);
            }
          }
        }
      }

      // Clear local auto-save draft
      clearDraft();
      navigate('/lecturer/my-quizzes');
    } catch (error) {
      console.error('Error saving quiz:', error);
      setValidationError(`Failed to ${isEditMode ? 'update' : 'create'} quiz`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 pb-20 overflow-x-hidden">
      {/* Interactive Stepper Navigation Header */}
      <StepperHeader
        currentStep={currentStep}
        onStepChange={handleStepChange}
        maxStepReached={maxStepReached}
        totalQuestions={isDynamicDraw ? (parseInt(drawQuestionCount, 10) || 0) : questions.length}
        totalMarks={totalMarks}
        durationMinutes={parseInt(duration, 10) || 0}
        isEditMode={isEditMode}
        lastAutoSaved={lastAutoSaved}
      />

      {/* Auto-Save Draft Restored Banner */}
      {draftRestoredBanner && !isEditMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-blue-900 shadow-xs">
          <div className="flex items-center gap-2">
            <RefreshCw size={15} className="text-blue-600 animate-spin-once" />
            <span>Restored unsubmitted draft from your previous session.</span>
          </div>
          <button
            type="button"
            onClick={clearDraft}
            className="font-bold text-blue-700 hover:text-blue-900 underline hover:no-underline"
          >
            Discard Draft
          </button>
        </div>
      )}

      {/* Academic Moderator Revision Banner */}
      {currentQuizObj?.status === 'rejected' && (
        <div className="bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 border-2 border-red-300 rounded-xl p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-lg flex-shrink-0">
              <AlertCircle size={22} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h3 className="text-base font-bold text-red-900">Moderator Revision Feedback</h3>
                <Badge variant="danger">Changes Requested</Badge>
              </div>
              <div className="bg-white/90 border border-red-200 rounded-lg p-3 text-sm text-red-800 font-medium">
                {rejectionFeedback || 'The moderator requested changes for this assessment. Please review questions and resubmit.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Validation Banner */}
      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-700 text-sm">
          <AlertCircle size={20} className="flex-shrink-0 text-red-600" />
          <p>{validationError}</p>
        </div>
      )}

      {/* Step 1: Basics & Identity */}
      {currentStep === 1 && (
        <ExamBasicsStep
          courseId={selectedCourseId}
          onCourseChange={(cId) => {
            setSelectedCourseId(cId);
            setCategoryPrefix('');
            setSelectedPoolCategories([]);
            const sel = courses.find(c => c.id === cId);
            if (sel && !subject) setSubject(sel.title);
          }}
          courses={courses}
          onOpenAddCourseModal={() => setShowAddCourseModal(true)}
          title={title}
          onTitleChange={setTitle}
          category={category}
          onCategoryChange={setCategory}
          categoryPrefix={categoryPrefix}
          onCategoryPrefixChange={setCategoryPrefix}
          courseCategories={courseCategories}
          onOpenCategoryModal={() => setShowCategoryModal(true)}
          subject={subject}
          onSubjectChange={setSubject}
          description={description}
          onDescriptionChange={setDescription}
          duration={duration}
          onDurationChange={setDuration}
          deadlineDate={deadlineDate}
          onDeadlineDateChange={setDeadlineDate}
          deadlineTime={deadlineTime}
          onDeadlineTimeChange={setDeadlineTime}
          onNext={() => handleStepChange(2)}
          isEditMode={isEditMode}
        />
      )}

      {/* Step 2: Questions Strategy */}
      {currentStep === 2 && (
        <QuestionsStrategyStep
          courseId={selectedCourseId}
          courses={courses}
          selectedCourse={selectedCourse}
          isDynamicDraw={isDynamicDraw}
          onDynamicDrawChange={setIsDynamicDraw}
          questions={questions}
          onOpenAddQuestionModal={() => {
            setCurrentQuestion({
              question_text: '',
              question_type: 'mcq',
              options: ['', '', '', ''],
              correct_answer: '',
              marks: 1,
            });
            setEditIndex(null);
            setShowQuestionModal(true);
          }}
          onEditQuestion={handleEditQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onOpenUploadModal={() => setShowImportModal(true)}
          onOpenBankPickerModal={handleOpenBankPicker}
          onDownloadTemplate={downloadQuestionTemplate}
          onExportCSV={exportQuestionsToCSV}
          saveToQuestionBank={saveToQuestionBank}
          onSaveToQuestionBankChange={setSaveToQuestionBank}
          bankStats={bankStats}
          poolCourseIds={poolCourseIds}
          onPoolCourseIdsChange={setPoolCourseIds}
          selectedPoolCategories={selectedPoolCategories}
          onSelectedPoolCategoriesChange={setSelectedPoolCategories}
          selectedPoolTiers={selectedPoolTiers}
          onSelectedPoolTiersChange={setSelectedPoolTiers}
          drawQuestionCount={drawQuestionCount}
          onDrawQuestionCountChange={setDrawQuestionCount}
          topicRules={topicRules}
          onTopicRulesChange={setTopicRules}
          activeQuestionsInPool={activeQuestionsInPool}
          courseCategories={courseCategories}
          hasMultipleSessions={hasMultipleSessions}
          onOpenSessionModal={() => setShowSessionModal(true)}
          onBack={() => handleStepChange(1)}
          onNext={() => handleStepChange(3)}
        />
      )}

      {/* Step 3: Security & Proctoring */}
      {currentStep === 3 && (
        <SecurityProctoringStep
          randomizeQuestions={randomizeQuestions}
          onRandomizeQuestionsChange={setRandomizeQuestions}
          randomizeOptions={randomizeOptions}
          onRandomizeOptionsChange={setRandomizeOptions}
          showResultsImmediately={showResultsImmediately}
          onShowResultsImmediatelyChange={setShowResultsImmediately}
          allowReview={allowReview}
          onAllowReviewChange={setAllowReview}
          passingScore={passingScore}
          onPassingScoreChange={setPassingScore}
          requireSeb={requireSeb}
          onRequireSebChange={setRequireSeb}
          enableCameraProctoring={enableCameraProctoring}
          onEnableCameraProctoringChange={setEnableCameraProctoring}
          enableScreenRecording={enableScreenRecording}
          onEnableScreenRecordingChange={setEnableScreenRecording}
          enableTabMonitoring={enableTabMonitoring}
          onEnableTabMonitoringChange={setEnableTabMonitoring}
          enableCopyPastePrevention={enableCopyPastePrevention}
          onEnableCopyPastePreventionChange={setEnableCopyPastePrevention}
          onBack={() => handleStepChange(2)}
          onNext={() => handleStepChange(4)}
        />
      )}

      {/* Step 4: Review & Launch Readiness Checklist */}
      {currentStep === 4 && (
        <ExamReviewChecklistStep
          courseId={selectedCourseId}
          courses={courses}
          title={title}
          category={category}
          categoryPrefix={categoryPrefix}
          duration={duration}
          deadlineDate={deadlineDate}
          deadlineTime={deadlineTime}
          isDynamicDraw={isDynamicDraw}
          drawQuestionCount={drawQuestionCount}
          activeQuestionsInPool={activeQuestionsInPool}
          questionsCount={questions.length}
          totalMarks={totalMarks}
          randomizeQuestions={randomizeQuestions}
          randomizeOptions={randomizeOptions}
          enableTabMonitoring={enableTabMonitoring}
          enableCopyPastePrevention={enableCopyPastePrevention}
          enableScreenRecording={enableScreenRecording}
          requireSeb={requireSeb}
          enableCameraProctoring={enableCameraProctoring}
          allowReview={allowReview}
          currentQuizObj={currentQuizObj}
          loading={loading}
          onStepChange={handleStepChange}
          onPreview={() => setShowPreviewModal(true)}
          onSubmit={(submitForReview) => handleSubmit(undefined, submitForReview)}
          onBack={() => handleStepChange(3)}
        />
      )}

      {/* Register New Institutional Course Modal */}
      <AddCourseModal
        isOpen={showAddCourseModal}
        onClose={() => setShowAddCourseModal(false)}
        userId={user?.id || ''}
        userName={user?.name || ''}
        onCourseCreated={async (newCourse) => {
          await loadCourses();
          setSelectedCourseId(newCourse.id);
          if (!subject) setSubject(newCourse.title);
        }}
      />

      {/* Bank Question Picker Modal */}
      <BankQuestionPickerModal
        isOpen={showBankPickerModal}
        onClose={() => setShowBankPickerModal(false)}
        courseCode={selectedCourse?.code || ''}
        bankQuestions={bankQuestions}
        loading={loadingBankQuestions}
        courseCategories={courseCategories}
        onImportSelected={(selected) => {
          setQuestions(prev => [...prev, ...selected]);
          setShowBankPickerModal(false);
        }}
      />

      {/* Universal Question Ingestion Modal */}
      {showImportModal && (
        <UniversalQuestionIngestionModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          courseCode={selectedCourse?.code}
          courseTitle={selectedCourse?.title}
          courseCategories={courseCategories}
          targetContext={isDynamicDraw ? 'question_bank' : 'quiz'}
          onImport={async (importedQuestions: ParsedIngestionQuestion[]) => {
            if (isDynamicDraw) {
              if (selectedCourseId) {
                const parsedItems = importedQuestions.map(q => ({
                  course_id: selectedCourseId,
                  topic: q.topic || 'General',
                  category: q.category || 'General',
                  category_prefix: q.category_prefix || undefined,
                  assessment_tier: q.assessment_tier || category || 'quiz',
                  difficulty: q.difficulty || 'medium',
                  question_type: q.question_type || 'mcq',
                  question_text: q.question_text,
                  options: q.options,
                  correct_answer: q.correct_answer,
                  marks: q.marks || 1,
                  status: 'active' as const
                }));
                await db.bulkInsertQuestionBank(selectedCourseId, parsedItems);
                alert(`Successfully imported ${parsedItems.length} questions into ${selectedCourse?.code || 'Course'} Question Bank!`);
                const updatedStats = await db.getQuestionBankStats(selectedCourseId);
                setBankStats(updatedStats);
              }
            } else {
              const converted: QuestionForm[] = importedQuestions.map(q => ({
                question_text: q.question_text,
                question_type: q.question_type,
                options: q.options,
                correct_answer: q.correct_answer,
                marks: q.marks || 1,
                topic: q.topic || 'General',
                difficulty: q.difficulty || 'medium',
                category: q.category || 'General',
                category_prefix: q.category_prefix || undefined,
              }));

              if (saveToQuestionBank && selectedCourseId) {
                try {
                  const bankItems = converted.map(c => ({
                    course_id: selectedCourseId,
                    topic: c.topic || 'General',
                    category: c.category || 'General',
                    category_prefix: c.category_prefix || undefined,
                    assessment_tier: category || 'quiz',
                    difficulty: c.difficulty || 'medium',
                    question_type: c.question_type || 'mcq',
                    question_text: c.question_text,
                    options: c.options,
                    correct_answer: c.correct_answer,
                    marks: c.marks || 1,
                    status: 'active' as const
                  }));
                  await db.bulkInsertQuestionBank(selectedCourseId, bankItems);
                } catch (e) {
                  console.error('Failed to auto-save imported questions to bank:', e);
                }
              }

              setQuestions(prev => [...prev, ...converted]);
            }
            setShowImportModal(false);
          }}
        />
      )}

      {/* Question Editor Modal */}
      <QuestionEditorModal
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setEditIndex(null);
        }}
        question={currentQuestion}
        isEditing={editIndex !== null}
        onSave={(savedQuestion) => {
          if (editIndex !== null) {
            const updated = [...questions];
            updated[editIndex] = savedQuestion;
            setQuestions(updated);
            setEditIndex(null);
          } else {
            setQuestions([...questions, savedQuestion]);
          }
          setCurrentQuestion({
            question_text: '',
            question_type: 'mcq',
            options: ['', '', '', ''],
            correct_answer: '',
            marks: 1,
          });
          setShowQuestionModal(false);
        }}
      />

      {/* Cohort Session Management Modal */}
      {id && (
        <QuizSessionManagerModal
          isOpen={showSessionModal}
          onClose={() => setShowSessionModal(false)}
          quiz={currentQuizObj || ({ id, title, course_id: selectedCourseId, lecturer_id: user?.id || '' } as Quiz)}
        />
      )}

      {/* Assessment Category Manager Modal */}
      {showCategoryModal && selectedCourseId && (
        <AssessmentCategoryModal
          isOpen={showCategoryModal}
          onClose={() => setShowCategoryModal(false)}
          courseId={selectedCourseId}
          courseCode={selectedCourse?.code}
          onCategoriesUpdated={(cats) => {
            setCourseCategories(cats);
            db.getQuestionBankStats(selectedCourseId)
              .then((stats: any) => setBankStats(stats))
              .catch(console.error);
          }}
        />
      )}

      {/* Quiz Pre-Submission Preview Modal */}
      {showPreviewModal && (
        <QuizPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onSubmitForReview={() => {
            setShowPreviewModal(false);
            handleSubmit(undefined, true);
          }}
          data={{
            title,
            description,
            subject,
            courseId: selectedCourseId,
            courseCode: selectedCourse?.code,
            courseTitle: selectedCourse?.title,
            durationMinutes: parseInt(duration, 10) || 60,
            totalMarks: totalMarks,
            category,
            categoryPrefix,
            courseCategories,
            deadline: deadlineDate ? `${deadlineDate} ${deadlineTime || ''}` : undefined,
            requireSeb,
            enableCameraProctoring,
            enableScreenRecording,
            enableTabMonitoring,
            enableCopyPastePrevention,
            allowReview,
            showResultsImmediately,
            isDynamicDraw,
            drawQuestionCount: parseInt(drawQuestionCount, 10) || 25,
            selectedPoolCategories,
            topicRules,
            poolMode,
            bankStats,
            poolCourseIds,
            poolCourseCodes: courses.filter(c => poolCourseIds.includes(c.id)).map(c => c.code),
            selectedPoolTiers,
            questions
          }}
        />
      )}
    </div>
  );
}
