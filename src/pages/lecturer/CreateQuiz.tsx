import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookOpen, Users, Edit2, AlertCircle, ChevronDown, ChevronUp, Trash2, Download, Upload, Shield, Video, Monitor, Lock, Eye, Shuffle, Layers, CheckCircle2 } from 'lucide-react';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { db, Course, Quiz, AssessmentCategory, TopicDrawRule, AssessmentCategoryItem } from '../../lib/database';
import { parseOptions } from '../../utils/quizUtils';
import { useAuth } from '../../contexts/AuthContext';
import { ASSESSMENT_CATEGORIES, parseTopicDrawRules, getCategoryColorBadgeClasses } from '../../utils/categoryUtils';
import QuizSessionManagerModal from '../../components/lecturer/QuizSessionManagerModal';
import QuestionEditorModal from '../../components/lecturer/QuestionEditorModal';
import { 
  parseQuestionsCSV, 
  generateQuestionCSVTemplate, 
  exportQuestionsToCSVString, 
  downloadCSVFile 
} from '../../utils/csvQuestionUtils';

interface QuestionForm {
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'essay';
  options: string[];
  correct_answer: string;
  marks: number;
}

export default function CreateQuiz() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const id = queryParams.get('id');
  console.log('URL ID parameter:', id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);
  const [category, setCategory] = useState<AssessmentCategory>('quiz');
  const [courseCategories, setCourseCategories] = useState<AssessmentCategoryItem[]>([]);
  const [categoryPrefix, setCategoryPrefix] = useState<string>('');
  const [bankCategoryFilter, setBankCategoryFilter] = useState<string>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isDynamicDraw, setIsDynamicDraw] = useState(false);
  const [poolMode, setPoolMode] = useState<'flat' | 'stratified'>('flat');
  const [topicRules, setTopicRules] = useState<Record<string, number>>({});
  const [drawQuestionCount, setDrawQuestionCount] = useState('25');
  const [hasMultipleSessions, setHasMultipleSessions] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [currentQuizObj, setCurrentQuizObj] = useState<Quiz | null>(null);
  const [rejectionFeedback, setRejectionFeedback] = useState<string>('');
  const [bankStats, setBankStats] = useState<any>(null);
  const [saveToQuestionBank, setSaveToQuestionBank] = useState(true);
  const [duration, setDuration] = useState('60');
  const [deadline, setDeadline] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [requireSeb, setRequireSeb] = useState(false);
  const [enableCameraProctoring, setEnableCameraProctoring] = useState(false);
  const [enableScreenRecording, setEnableScreenRecording] = useState(false);
  const [enableTabMonitoring, setEnableTabMonitoring] = useState(true);
  const [enableCopyPastePrevention, setEnableCopyPastePrevention] = useState(true);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionForm>({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  // Bank Picker modal states
  const [showBankPickerModal, setShowBankPickerModal] = useState(false);
  const [bankQuestions, setBankQuestions] = useState<any[]>([]);
  const [loadingBankQuestions, setLoadingBankQuestions] = useState(false);
  const [selectedBankQuestionIds, setSelectedBankQuestionIds] = useState<Set<string>>(new Set());
  const [bankPickerSearch, setBankPickerSearch] = useState('');
  const [bankPickerTopic, setBankPickerTopic] = useState('all');
  const [bankPickerDifficulty, setBankPickerDifficulty] = useState('all');
  const [bankPickerCategory, setBankPickerCategory] = useState('all');

  const toggleQuestionExpanded = (index: number) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // CSV Template Generation
  const downloadQuestionTemplate = () => {
    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    const template = generateQuestionCSVTemplate(selectedCourse?.code);
    downloadCSVFile(template, `${selectedCourse?.code || 'Course'}_Question_Template.csv`);
  };

  // CSV Export Function
  const exportQuestionsToCSV = () => {
    if (questions.length === 0) {
      alert('No questions to export');
      return;
    }
    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    const content = exportQuestionsToCSVString(
      questions,
      `${title || 'Quiz'} Questions (${selectedCourse?.code || 'Course'})`
    );
    const filename = `${title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'quiz'}_questions.csv`;
    downloadCSVFile(content, filename);
  };

  // CSV Import Function
  const importQuestionsFromCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const selectedCourse = courses.find(c => c.id === selectedCourseId);
      const result = parseQuestionsCSV(text, selectedCourse?.code || 'General');

      if (!result.success || result.questions.length === 0) {
        alert(result.errors.length > 0 ? result.errors.join('\n') : 'The CSV file contains no valid questions.');
        return;
      }

      setQuestions(prev => [...prev, ...result.questions]);
      setShowImportModal(false);
      setImportFile(null);

      if (result.errors.length > 0) {
        alert(`Imported ${result.questions.length} questions with warnings:\n` + result.errors.slice(0, 5).join('\n'));
      } else {
        alert(`Successfully imported ${result.questions.length} questions!`);
      }
    };

    reader.onerror = () => {
      alert('Error reading the CSV file. Please try again.');
    };

    reader.readAsText(file);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setImportFile(file);
      } else {
        alert('Please select a CSV file.');
        setImportFile(null);
      }
    }
  };

  // Handle import
  const handleImport = () => {
    if (importFile) {
      importQuestionsFromCSV(importFile);
    }
  };

  // Add a useEffect to log questions array changes
  useEffect(() => {
    console.log('Current questions in state:', questions);
  }, [questions]);

  // Add useEffect to monitor modal state
  useEffect(() => {
    console.log('Question modal state:', showQuestionModal);
    console.log('Current question:', currentQuestion);
    console.log('Edit index:', editIndex);
  }, [showQuestionModal, currentQuestion, editIndex]);

  // Load courses
  useEffect(() => {
    if (user) {
      db.getCourses(user.id).then((data: any) => {
        setCourses(data as Course[]);
      }).catch((err: any) => console.error('Error fetching courses in CreateQuiz:', err));
    }
  }, [user]);

  // Load question bank stats and categories when course is selected
  useEffect(() => {
    if (selectedCourseId) {
      db.getQuestionBankStats(selectedCourseId).then((stats: any) => {
        setBankStats(stats);
        if (stats && stats.active > 0) {
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

  // Sync drawQuestionCount when stratified mode is active
  useEffect(() => {
    if (isDynamicDraw && poolMode === 'stratified') {
      const sum = Object.values(topicRules).reduce((acc, count) => acc + (Number(count) || 0), 0);
      setDrawQuestionCount(String(sum));
    }
  }, [topicRules, isDynamicDraw, poolMode]);

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

  const handleOpenBankPicker = async () => {
    if (!selectedCourseId) {
      alert('Please select an Institutional Course first.');
      return;
    }
    setShowBankPickerModal(true);
    setLoadingBankQuestions(true);
    setSelectedBankQuestionIds(new Set());
    setBankPickerCategory(categoryPrefix || bankCategoryFilter || 'all');
    try {
      const data = await db.getQuestionBankQuestions(selectedCourseId, { status: 'active' });
      setBankQuestions(data || []);
    } catch (err) {
      console.error('Failed to load bank questions:', err);
    } finally {
      setLoadingBankQuestions(false);
    }
  };

  const handleToggleSelectBankQuestion = (qId: string) => {
    setSelectedBankQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(qId)) next.delete(qId);
      else next.add(qId);
      return next;
    });
  };

  const handleSelectAllBankQuestions = (filteredList: any[]) => {
    if (selectedBankQuestionIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedBankQuestionIds(new Set());
    } else {
      setSelectedBankQuestionIds(new Set(filteredList.map(q => q.id)));
    }
  };

  const handleImportSelectedFromBank = () => {
    const toImport = bankQuestions.filter(q => selectedBankQuestionIds.has(q.id));
    const formatted: QuestionForm[] = toImport.map(item => {
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

    setQuestions(prev => [...prev, ...formatted]);
    setShowBankPickerModal(false);
    setSelectedBankQuestionIds(new Set());
  };

  // Load quiz data if in edit mode
  useEffect(() => {
    console.log('useEffect triggered with id:', id);
    if (id) {
      console.log('ID exists, setting edit mode and loading quiz data');
      setIsEditMode(true);
      loadQuizData(id);
    } else {
      console.log('No ID provided, staying in create mode');
    }
  }, [id]);

  const loadQuizData = async (quizId: string) => {
    try {
      setLoading(true);
      console.log('Loading quiz data for ID:', quizId);
      const quiz = await db.getQuiz(quizId);
      console.log('Quiz loaded:', quiz);

      if (!quiz) {
        alert('Quiz not found');
        navigate('/lecturer/my-quizzes');
        return;
      }

      setCurrentQuizObj(quiz as Quiz);

      // Set quiz details
      if (quiz.category) {
        setCategory(quiz.category as AssessmentCategory);
      }
      if (quiz.category_prefix) {
        setCategoryPrefix(quiz.category_prefix);
      }
      if (quiz.bank_category_filter) {
        setBankCategoryFilter(quiz.bank_category_filter);
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
      setTitle(quiz.title);
      setDescription(quiz.description || '');
      setSubject(quiz.subject);
      setDuration(quiz.duration_minutes.toString());
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
        const deadline = new Date(quiz.deadline);
        setDeadlineDate(deadline.toISOString().split('T')[0]);
        setDeadlineTime(deadline.toTimeString().slice(0, 5));
      }

      // Load questions separately
      const quizQuestions = await db.getQuestions(quizId);
      console.log('Quiz questions loaded:', quizQuestions);
      const formattedQuestions = quizQuestions.map((q: any) => {
        let options: string[] = ['', '', '', ''];
        if (q.question_type === 'mcq') {
          const parsed = parseOptions(q.options);
          options = parsed.length >= 4
            ? parsed.slice(0, 4)
            : [...parsed, ...Array(Math.max(0, 4 - parsed.length)).fill('')];
        } else if (q.question_type === 'true_false') {
          options = ['True', 'False', '', ''];
        } else {
          options = ['', '', '', ''];
        }

        return {
          question_text: q.question_text || '',
          question_type: (q.question_type || 'mcq') as 'mcq' | 'true_false' | 'essay',
          options: options,
          correct_answer: q.correct_answer || '',
          marks: q.marks || 1
        };
      });

      console.log('Formatted questions:', formattedQuestions);
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

  const handleEditQuestion = (index: number) => {
    console.log('Editing question at index:', index);
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

  const handleSubmit = async (e: FormEvent, submitForReview: boolean = false) => {
    e.preventDefault();
    setValidationError('');

    if (!title.trim()) {
      setValidationError('Quiz title is required');
      return;
    }

    if (isDynamicDraw) {
      if (!selectedCourseId) {
        setValidationError('Please select an Institutional Course for the Dynamic Question Bank Draw');
        return;
      }
      const activeCount = bankStats ? Number(bankStats.active) : 0;
      if (activeCount === 0) {
        setValidationError('The question bank for this course has 0 active questions. Please add questions to the bank or import questions first.');
        return;
      }

      if (poolMode === 'stratified') {
        const formattedRules: TopicDrawRule[] = Object.entries(topicRules)
          .filter(([_, count]) => count > 0)
          .map(([topic, count]) => ({ topic, count }));

        const totalStratified = formattedRules.reduce((sum, r) => sum + r.count, 0);
        if (formattedRules.length === 0 || totalStratified < 1) {
          setValidationError('Please allocate at least 1 question in the Topic Blueprint matrix for stratified draw.');
          return;
        }

        // Check each topic quota against active bank capacity
        for (const rule of formattedRules) {
          const active = bankStats?.topicCounts?.[rule.topic]?.active ?? 0;
          if (rule.count > active) {
            setValidationError(`Topic "${rule.topic}" has only ${active} active questions, but ${rule.count} was specified.`);
            return;
          }
        }
      } else {
        const count = parseInt(drawQuestionCount, 10);
        if (!count || count < 1) {
          setValidationError('Please specify how many questions to draw per student (at least 1)');
          return;
        }
        if (count > activeCount) {
          setValidationError(`Cannot draw ${count} questions: only ${activeCount} active question${activeCount === 1 ? '' : 's are'} available in the course question bank.`);
          return;
        }

        if (bankCategoryFilter !== 'all' && bankStats?.categoryCounts) {
          const catObj = courseCategories.find(c => c.prefix === bankCategoryFilter);
          const catName = catObj ? catObj.name : bankCategoryFilter;
          const catActive = bankStats.categoryCounts[catName]?.active;
          if (typeof catActive === 'number' && count > catActive) {
            setValidationError(`Cannot draw ${count} questions: only ${catActive} active questions exist with prefix [${bankCategoryFilter}] in the course question bank.`);
            return;
          }
        }
      }
    } else {
      if (questions.length === 0) {
        setValidationError('At least one question is required');
        return;
      }
    }

    const durationNum = parseInt(duration);
    if (!durationNum || durationNum < 1) {
      setValidationError('Duration must be at least 1 minute');
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
            .map(([topic, count]) => ({ topic, count }))
        : [];

      const effectiveDrawCount = isDynamicDraw
        ? (poolMode === 'stratified'
            ? formattedTopicRules.reduce((sum, r) => sum + r.count, 0)
            : (parseInt(drawQuestionCount, 10) || 25))
        : 0;

      const totalMarks = isDynamicDraw 
        ? effectiveDrawCount * 1
        : questions.reduce((sum, q) => sum + q.marks, 0);

      const quizPayload = {
        course_id: selectedCourseId || null,
        title,
        description,
        subject,
        duration_minutes: durationNum,
        total_marks: totalMarks,
        category,
        category_prefix: categoryPrefix ? categoryPrefix.toUpperCase().trim() : null,
        bank_category_filter: bankCategoryFilter || 'all',
        topic_draw_rules: formattedTopicRules,
        status: submitForReview ? 'pending_approval' : 'draft',
        deadline: deadline ? new Date(deadline).toISOString() : null,
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
      };

      if (isEditMode && id) {
        // Update existing quiz
        await db.updateQuiz(id, quizPayload);

        if (!isDynamicDraw) {
          // Delete existing questions and recreate them in parallel
          const existingQuestions = await db.getQuestions(id);
          await Promise.all(existingQuestions.map((q: any) => db.deleteQuestion(q.id)));

          // Insert updated questions in parallel
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
              await db.syncQuizQuestionsToBank(selectedCourseId, questions);
            } catch (bankErr) {
              console.warn('Note on question bank sync:', bankErr);
            }
          }
        }
      } else {
        // Create New Exams
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

          // Insert all questions in parallel
          await Promise.all(questionsToInsert.map(q => db.createQuestion(q)));

          if (selectedCourseId && saveToQuestionBank) {
            try {
              await db.syncQuizQuestionsToBank(selectedCourseId, questions);
            } catch (bankErr) {
              console.warn('Note on question bank sync:', bankErr);
            }
          }
        }
      }

      navigate('/lecturer/my-quizzes');
    } catch (error) {
      console.error('Error saving quiz:', error);
      setValidationError(`Failed to ${isEditMode ? 'update' : 'create'} quiz`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 sm:px-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditMode ? 'Edit Quiz' : 'Create New Exams'}
      </h1>

      {currentQuizObj?.status === 'rejected' && (
        <div className="bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 border-2 border-red-300 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-lg flex-shrink-0">
              <AlertCircle size={22} />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h3 className="text-base font-bold text-red-900">
                  Moderator Revision Feedback
                </h3>
                <Badge variant="danger">Changes Requested</Badge>
              </div>
              <div className="bg-white/85 border border-red-200 rounded-lg p-3.5 text-sm text-red-800 font-medium leading-relaxed shadow-xs">
                {rejectionFeedback || 'The moderator requested changes for this quiz. Please review and update your questions below.'}
              </div>
              <p className="text-xs text-red-700">
                Update the questions or exam settings based on the feedback above, then click <strong>"Save & Resubmit for Review"</strong> to send this quiz back to the moderation queue.
              </p>
            </div>
          </div>
        </div>
      )}

      {validationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <p className="text-red-700 text-sm">{validationError}</p>
        </div>
      )}

      <Card className="sticky top-0 z-10 shadow-lg mb-8">
        <form className="space-y-4">
          {/* Assessment Classification Selector */}
          <div>
            <label className="block text-sm font-semibold text-gray-800 mb-1">
              Assessment Classification <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2.5">
              Select the assessment tier to categorize this exam for grading, scheduling, and moderation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {ASSESSMENT_CATEGORIES.map((cat) => {
                const isSelected = category === cat.key;
                const emojiIcon = 
                  cat.key === 'final_exam' ? '🎓' :
                  cat.key === 'mid_semester' ? '📝' :
                  cat.key === 'class_test' ? '📋' :
                  cat.key === 'quiz' ? '⚡' : '🎯';

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => {
                      setCategory(cat.key);
                      if (cat.key === 'final_exam' && duration === '60') setDuration('120');
                      else if (cat.key === 'mid_semester' && duration === '120') setDuration('60');
                      else if (cat.key === 'quiz' && (duration === '120' || duration === '60')) setDuration('30');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xl">{emojiIcon}</span>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-blue-600" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                      )}
                    </div>
                    <div>
                      <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                        {cat.label}
                      </div>
                      <div className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                        {cat.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Assessment Category & Prefix Tag */}
            {selectedCourseId && courseCategories.length > 0 && (
              <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Course Assessment Category Tag & Prefix (Optional)
                  </label>
                  {categoryPrefix && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border uppercase ${
                      getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === categoryPrefix)?.color)
                    }`}>
                      [{categoryPrefix}] {courseCategories.find(c => c.prefix === categoryPrefix)?.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={categoryPrefix}
                    onChange={(e) => {
                      const pref = e.target.value;
                      setCategoryPrefix(pref);
                      if (pref) {
                        setBankCategoryFilter(pref);
                      }
                    }}
                    className="flex-1 text-xs border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Course Prefix (General Pool)</option>
                    {courseCategories.map((c) => (
                      <option key={c.id} value={c.prefix}>
                        [{c.prefix}] {c.name}
                      </option>
                    ))}
                  </select>
                  {categoryPrefix && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setCategoryPrefix('')}
                      className="text-xs text-gray-500 py-1.5 px-2"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  Tag this quiz with a custom prefix code (e.g. [MID25]). You can filter the question bank or restrict dynamic draws specifically to questions with this category prefix.
                </p>
              </div>
            )}
          </div>

          <Input
            label="Quiz Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter quiz title"
            required
          />

          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter quiz description"
            rows={3}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Institutional Course <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  const sel = courses.find(c => c.id === e.target.value);
                  if (sel && !subject) setSubject(sel.title);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
              >
                <option value="">-- Select Course (e.g. CS101) --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.title} {c.assigned_lecturer_id === user?.id ? '(Assigned)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Courses are centrally defined by the institution.</p>
              
              {selectedCourseId && !isDynamicDraw && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-800 mt-2 bg-blue-50/80 p-2.5 rounded-lg border border-blue-200">
                  <input
                    type="checkbox"
                    checked={saveToQuestionBank}
                    onChange={(e) => setSaveToQuestionBank(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="font-medium">
                    Automatically save these questions into the <strong>{courses.find(c => c.id === selectedCourseId)?.code}</strong> Question Bank
                  </span>
                </label>
              )}
            </div>

            <Input
              label="Subject / Topic Area"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Computer Science"
            />
          </div>

          <div>
            <Input
              label="Duration (minutes)"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline Date (optional)
              </label>
              <input
                type="date"
                value={deadlineDate}
                onChange={(e) => {
                  setDeadlineDate(e.target.value);
                  if (e.target.value && deadlineTime) {
                    setDeadline(`${e.target.value}T${deadlineTime}`);
                  } else if (e.target.value) {
                    setDeadline(`${e.target.value}T23:59`);
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline Time (optional)
              </label>
              <select
                value={deadlineTime}
                onChange={(e) => {
                  setDeadlineTime(e.target.value);
                  if (deadlineDate && e.target.value) {
                    setDeadline(`${deadlineDate}T${e.target.value}`);
                  } else if (deadlineDate) {
                    setDeadline(`${deadlineDate}T23:59`);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select time</option>
                {Array.from({ length: 24 }, (_, hour24) => {
                  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                  const period = hour24 < 12 ? 'AM' : 'PM';
                  return Array.from({ length: 2 }, (_, half) => {
                    const minute = half === 0 ? '00' : '30';
                    const time24 = `${hour24.toString().padStart(2, '0')}:${minute}`;
                    const time12 = `${hour12}:${minute} ${period}`;
                    return (
                      <option key={time24} value={time24}>
                        {time12} (GMT)
                      </option>
                    );
                  });
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select time from dropdown (Ghana timezone - 30-minute intervals)
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Select date and time when quiz will no longer be available
          </p>

          <div className="border-t pt-4 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Exams Settings</h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Randomize Question Order
                  </label>
                  <p className="text-xs text-gray-500">
                    Questions will appear in random order for each student
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={randomizeQuestions}
                  onChange={(e) => setRandomizeQuestions(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Randomize Option Order
                  </label>
                  <p className="text-xs text-gray-500">
                    Multiple choice options will be shuffled for each question
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={randomizeOptions}
                  onChange={(e) => setRandomizeOptions(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Show Results Immediately
                  </label>
                  <p className="text-xs text-gray-500">
                    Students see their score right after submission
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={showResultsImmediately}
                  onChange={(e) => setShowResultsImmediately(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Allow Review
                  </label>
                  <p className="text-xs text-gray-500">
                    Students can review their answers after submission
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={allowReview}
                  onChange={(e) => setAllowReview(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>

              {/* Anti-Cheating & Device Settings */}
              <div className="border-t pt-4 mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={20} className="text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Anti-Cheating & Device Settings</h3>
                </div>

                <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Lock size={16} className="text-amber-600" />
                        <label className="text-sm font-semibold text-gray-800">
                          Require Safe Exam Browser (SEB)
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enforce SEB lockdown (desktop/laptop only). <strong>Leave unchecked for Homework & Assignments</strong> so students can take it on mobile phones or regular browsers.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={requireSeb}
                      onChange={(e) => setRequireSeb(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Video size={16} className="text-blue-600" />
                        <label className="text-sm font-semibold text-gray-800">
                          Enable Camera Proctoring (Webcam)
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Streams live student webcam video during the test (ideal for lab exercises or remote exams).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableCameraProctoring}
                      onChange={(e) => setEnableCameraProctoring(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Monitor size={16} className="text-purple-600" />
                        <label className="text-sm font-semibold text-gray-800">
                          Enable Screen Recording
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Records student screen during the quiz. (Requires laptop/desktop; not supported on mobile phones).
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableScreenRecording}
                      onChange={(e) => setEnableScreenRecording(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <Eye size={16} className="text-indigo-600" />
                        <label className="text-sm font-semibold text-gray-800">
                          Tab Switch & Window Monitoring
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Tracks and logs when a student switches tabs or minimizes the window.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableTabMonitoring}
                      onChange={(e) => setEnableTabMonitoring(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-green-600" />
                        <label className="text-sm font-semibold text-gray-800">
                          Disable Copy, Paste & Right-Click
                        </label>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Blocks right-click context menu and copy/paste keyboard shortcuts.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={enableCopyPastePrevention}
                      onChange={(e) => setEnableCopyPastePrevention(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </Card>

      {/* Question Bank & Multi-Session Cohort Strategy */}
      <Card className="border-purple-200">
        <div className="flex items-center gap-2 mb-2">
          <Shuffle className="text-purple-600" size={20} />
          <h3 className="text-lg font-semibold text-gray-900">Dynamic Question Bank & Cohort Sessions</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Eliminate question leaks between student batches using stratified random draws and session partitioning.
        </p>

        <div className="space-y-4 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <label className="text-sm font-semibold text-gray-800">
                Dynamic Question Bank Draw
              </label>
              <p className="text-xs text-gray-600">
                Draw random, balanced question subsets dynamically from the Course Question Bank for each student.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isDynamicDraw}
              onChange={(e) => setIsDynamicDraw(e.target.checked)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
          </div>

          {isDynamicDraw && (
            <div className="space-y-3.5 pt-3 border-t border-purple-200/60 animate-fadeIn">
              {!selectedCourseId ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <span>Please select an Institutional Course above to draw from its Question Bank.</span>
                </div>
              ) : bankStats && bankStats.active === 0 ? (
                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle size={18} className="text-rose-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong className="block font-bold mb-0.5">Question Bank is Empty</strong>
                    <span>
                      {courses.find(c => c.id === selectedCourseId)?.code} has 0 active questions in its bank. 
                      Please add questions in the Question Bank or import a CSV before configuring Dynamic Draw.
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Category Scope / Bank Filter */}
                  <div className="mb-3.5 p-3 bg-purple-50/60 rounded-xl border border-purple-200/70">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                        Question Pool Category Scope
                      </label>
                      {bankCategoryFilter !== 'all' && (
                        <span className="text-xs font-semibold text-purple-700">
                          Restricted to [{bankCategoryFilter}]
                        </span>
                      )}
                    </div>
                    <select
                      value={bankCategoryFilter}
                      onChange={(e) => setBankCategoryFilter(e.target.value)}
                      className="w-full text-xs border border-purple-200 rounded-lg p-2 bg-white text-gray-800 focus:ring-2 focus:ring-purple-400"
                    >
                      <option value="all">All Active Bank Questions ({bankStats?.active || 0} questions)</option>
                      {courseCategories.map((c) => {
                        const count = bankStats?.categoryCounts?.[c.name]?.active ?? 0;
                        return (
                          <option key={c.id} value={c.prefix}>
                            Restrict Draw to: [{c.prefix}] {c.name} ({count} active)
                          </option>
                        );
                      })}
                      <option value="uncategorized">General / Uncategorized Only</option>
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Draw questions exclusively from this category/prefix so questions from older terms or other assessments are never drawn.
                    </p>
                  </div>

                  {/* Pooling Strategy Mode Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-purple-100/70 rounded-xl w-fit mb-3">
                    <button
                      type="button"
                      onClick={() => setPoolMode('flat')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        poolMode === 'flat'
                          ? 'bg-white text-purple-900 shadow-xs'
                          : 'text-purple-700 hover:text-purple-900'
                      }`}
                    >
                      <Shuffle size={13} />
                      <span>Uniform Random Pool</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPoolMode('stratified')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        poolMode === 'stratified'
                          ? 'bg-white text-purple-900 shadow-xs'
                          : 'text-purple-700 hover:text-purple-900'
                      }`}
                    >
                      <Layers size={13} />
                      <span>Topic Matrix Blueprint ({bankStats?.topics?.length || 0} Topics)</span>
                    </button>
                  </div>

                  {poolMode === 'flat' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                          Questions Drawn per Student
                        </label>
                        {bankStats && (
                          <span className="text-xs font-semibold text-purple-700 bg-purple-100/70 px-2.5 py-0.5 rounded-full border border-purple-200">
                            Pool: {bankStats.active} Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max={bankStats?.active || 100}
                          value={drawQuestionCount}
                          onChange={(e) => {
                            const val = e.target.value;
                            const num = parseInt(val, 10);
                            if (bankStats && num > bankStats.active) {
                              setDrawQuestionCount(String(bankStats.active));
                            } else {
                              setDrawQuestionCount(val);
                            }
                          }}
                          className={`w-36 px-3 py-2 border rounded-xl bg-white text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 shadow-xs ${
                            bankStats && (parseInt(drawQuestionCount, 10) > bankStats.active || parseInt(drawQuestionCount, 10) < 1)
                              ? 'border-rose-400 focus:ring-rose-500 bg-rose-50/30'
                              : 'border-purple-300 focus:ring-purple-500'
                          }`}
                        />
                        <span className="text-xs text-gray-500 font-medium">
                          out of {bankStats?.active ?? '...'} total active questions
                        </span>
                      </div>

                      {/* Over-capacity warning */}
                      {bankStats && parseInt(drawQuestionCount, 10) > bankStats.active && (
                        <p className="text-xs font-semibold text-rose-600 flex items-center gap-1.5 mt-2 bg-rose-50 p-2 rounded-lg border border-rose-200">
                          <AlertCircle size={14} className="flex-shrink-0" />
                          <span>Cannot exceed {bankStats.active} available questions in the bank.</span>
                        </p>
                      )}

                      {/* Quick preset selector buttons */}
                      {bankStats && bankStats.active > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                          <span className="text-[11px] font-semibold text-gray-500 mr-1">Quick Presets:</span>
                          {[5, 10, 20, 25, 50]
                            .filter(n => n < bankStats.active)
                            .map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setDrawQuestionCount(String(n))}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                                  drawQuestionCount === String(n)
                                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          <button
                            type="button"
                            onClick={() => setDrawQuestionCount(String(bankStats.active))}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                              drawQuestionCount === String(bankStats.active)
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 font-bold'
                            }`}
                          >
                            All ({bankStats.active})
                          </button>
                        </div>
                      )}

                      <p className="text-xs text-gray-500 mt-2">
                        Every student will receive a unique randomized subset of {drawQuestionCount || 0} questions upon starting the exam.
                      </p>
                    </div>
                  ) : (
                    /* Stratified Topic Matrix Blueprint */
                    <div className="space-y-3 bg-white p-4 rounded-xl border border-purple-200 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                        <div>
                          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={14} className="text-purple-600" />
                            <span>Stratified Topic Blueprint</span>
                          </h4>
                          <p className="text-[11px] text-gray-500">
                            Allocate exact question quotas per syllabus topic. Candidates will receive balanced draws respecting this distribution.
                          </p>
                        </div>

                        {/* Matrix Quick Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              const updated: Record<string, number> = {};
                              (bankStats?.topics || []).forEach((t: string) => {
                                const active = bankStats?.topicCounts?.[t]?.active ?? 0;
                                updated[t] = Math.min(5, active);
                              });
                              setTopicRules(updated);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                          >
                            5 Each
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated: Record<string, number> = {};
                              (bankStats?.topics || []).forEach((t: string) => {
                                const active = bankStats?.topicCounts?.[t]?.active ?? 0;
                                updated[t] = Math.floor(active / 2);
                              });
                              setTopicRules(updated);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700"
                          >
                            Half Available
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const updated: Record<string, number> = {};
                              (bankStats?.topics || []).forEach((t: string) => {
                                updated[t] = 0;
                              });
                              setTopicRules(updated);
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
                          >
                            Clear (0)
                          </button>
                        </div>
                      </div>

                      {/* Topic Rows */}
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {(!bankStats?.topics || bankStats.topics.length === 0) ? (
                          <p className="text-center py-6 text-gray-400 text-xs">
                            No topics found in this course question bank. Add topics to question bank items to configure stratified pooling.
                          </p>
                        ) : (
                          bankStats.topics.map((topicName: string) => {
                            const activeInTopic = bankStats.topicCounts?.[topicName]?.active ?? 0;
                            const totalInTopic = bankStats.topicCounts?.[topicName]?.total ?? 0;
                            const currentCount = topicRules[topicName] || 0;
                            const isExceeded = currentCount > activeInTopic;

                            return (
                              <div
                                key={topicName}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                  currentCount > 0
                                    ? 'bg-purple-50/40 border-purple-200'
                                    : 'bg-gray-50/50 border-gray-200'
                                }`}
                              >
                                <div className="min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-900 truncate">
                                      {topicName}
                                    </span>
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                      {activeInTopic} active {totalInTopic > activeInTopic ? `(${totalInTopic} total)` : ''}
                                    </span>
                                  </div>
                                  {isExceeded && (
                                    <span className="text-[10px] text-rose-600 font-bold block mt-0.5">
                                      Cannot draw {currentCount}: only {activeInTopic} active questions available.
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTopicRules(prev => ({
                                        ...prev,
                                        [topicName]: Math.max(0, (prev[topicName] || 0) - 1)
                                      }));
                                    }}
                                    disabled={currentCount <= 0}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="0"
                                    max={activeInTopic}
                                    value={currentCount}
                                    onChange={(e) => {
                                      const parsed = parseInt(e.target.value, 10);
                                      const clamped = isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, activeInTopic));
                                      setTopicRules(prev => ({
                                        ...prev,
                                        [topicName]: clamped
                                      }));
                                    }}
                                    className={`w-14 text-center px-1 py-1 rounded-lg border text-xs font-bold ${
                                      isExceeded
                                        ? 'border-rose-400 bg-rose-50 text-rose-700'
                                        : currentCount > 0
                                        ? 'border-purple-300 bg-white text-purple-900'
                                        : 'border-gray-200 bg-white text-gray-400'
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTopicRules(prev => ({
                                        ...prev,
                                        [topicName]: Math.min(activeInTopic, (prev[topicName] || 0) + 1)
                                      }));
                                    }}
                                    disabled={currentCount >= activeInTopic}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 text-sm font-bold"
                                  >
                                    +
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTopicRules(prev => ({
                                        ...prev,
                                        [topicName]: activeInTopic
                                      }));
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                                    title="Allocate all active questions in this topic"
                                  >
                                    Max
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Blueprint Summary Footer */}
                      <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-gray-600 font-medium">Total Questions to Draw:</span>
                          <span className="text-sm font-extrabold text-purple-900 bg-purple-100/80 px-2.5 py-0.5 rounded-lg border border-purple-200">
                            {Object.values(topicRules).reduce((s, c) => s + (Number(c) || 0), 0)} Questions
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                          <span>
                            {Object.values(topicRules).filter(c => Number(c) > 0).length} of {bankStats?.topics?.length || 0} topics covered
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {bankStats && bankStats.active > 0 && (
                <div className="p-3 bg-white rounded-xl border border-purple-200/80 text-xs text-gray-700 flex flex-wrap gap-4 items-center">
                  <div>
                    <span className="font-medium text-gray-500">Course Pool Breakdown:</span>{' '}
                    <strong className="text-gray-900">{bankStats.active} Active Questions</strong>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">{bankStats.easy} Easy</span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">{bankStats.medium} Medium</span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">{bankStats.hard} Hard</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Multi-Session Cohort Partitioning */}
          <div className="pt-3 border-t border-purple-200/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <Users size={16} className="text-purple-600" />
                  <span>Multi-Session Cohort Partitioning (e.g., Lab Group A / Group B)</span>
                </label>
                <p className="text-xs text-gray-600">
                  Split your class into separate lab groups with independent timetable windows, access PINs, and non-overlapping question pools.
                </p>
              </div>
              <input
                type="checkbox"
                checked={hasMultipleSessions}
                onChange={(e) => setHasMultipleSessions(e.target.checked)}
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded cursor-pointer"
              />
            </div>

            {hasMultipleSessions && (
              <div className="mt-3 p-3.5 bg-purple-50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-purple-200">
                <div className="text-xs text-purple-900">
                  <div className="font-bold flex items-center gap-1.5 text-purple-800 text-sm">
                    <Shield size={16} />
                    <span>Academic Officer Cohort Scheduling</span>
                  </div>
                  <p className="text-purple-700 mt-0.5">
                    Flagged for multi-session delivery. The Academic Officer (Admin) will configure exam session schedules (Session 1, Session 2...), generate secret invigilator PINs, assign student rosters, and publish the assessment upon moderation approval.
                  </p>
                </div>
                <Badge variant="primary" className="whitespace-nowrap">Managed by Academic Officer</Badge>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Questions Section: Dynamic Banner or Manual Builder */}
      {isDynamicDraw ? (
        <Card className="border-purple-200 bg-purple-50/30">
          <div className="text-center py-8 px-4 space-y-4">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Shuffle size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {poolMode === 'stratified' ? 'Stratified Topic Blueprint Active' : 'Dynamic Bank Draw Active'}
              </h3>
              <p className="text-sm text-gray-600 max-w-lg mx-auto mt-1">
                This exam will draw <strong>{drawQuestionCount} questions</strong> dynamically from the{' '}
                <strong>{courses.find(c => c.id === selectedCourseId)?.code || 'Course'} Question Bank</strong> for each student.
                {hasMultipleSessions && ' Cohort sessions will receive non-overlapping pools with equal difficulty distributions.'}
              </p>

              {poolMode === 'stratified' && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3 max-w-xl mx-auto">
                  {Object.entries(topicRules)
                    .filter(([_, count]) => count > 0)
                    .map(([topic, count]) => (
                      <span
                        key={topic}
                        className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200"
                      >
                        {topic}: <strong>{count} Qs</strong>
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div className="pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => navigate('/lecturer/question-bank')}
                className="inline-flex items-center gap-2"
              >
                <BookOpen size={16} />
                Manage Course Question Bank
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Questions ({questions.length})
            </h2>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {selectedCourseId && (
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleOpenBankPicker}
                  className="flex items-center justify-center gap-1.5 border-blue-400 text-blue-700 bg-blue-50/80 hover:bg-blue-100 font-semibold text-xs py-2 px-3"
                  title="Browse and select specific questions from the Course Question Bank"
                >
                  <BookOpen size={16} />
                  <span>Pick from Bank</span>
                </Button>
              )}
              <Button
                variant="secondary"
                type="button"
                onClick={downloadQuestionTemplate}
                className="flex items-center justify-center gap-1.5 text-xs py-2 px-3"
              >
                <Download size={16} />
                <span>Template</span>
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={() => setShowImportModal(true)}
                className="flex items-center justify-center gap-1.5 text-xs py-2 px-3"
              >
                <Upload size={16} />
                <span>Import</span>
              </Button>
              <Button
                variant="secondary"
                type="button"
                onClick={exportQuestionsToCSV}
                disabled={questions.length === 0}
                className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 disabled:opacity-50"
              >
                <Download size={16} />
                <span>Export</span>
              </Button>
              <Button 
                type="button" 
                onClick={() => setShowQuestionModal(true)} 
                className="flex items-center justify-center gap-1.5 text-xs py-2 px-3 bg-blue-600 text-white"
              >
                <Plus size={16} />
                <span>Add Question</span>
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No questions added yet</p>
          ) : (
            <div className="space-y-3">
              {questions.map((q, index) => {
                const isExpanded = expandedQuestions.has(index);
                return (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    {/* Question Header - Always Visible */}
                    <div
                      className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => toggleQuestionExpanded(index)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium">Q{index + 1}.</span>
                        <Badge variant="secondary">{q.question_type}</Badge>
                        <Badge variant="primary">{q.marks} marks</Badge>
                        <p className="text-gray-700 truncate break-words max-w-full">{q.question_text}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditQuestion(index);
                          }}
                          className="text-blue-600 hover:text-blue-700 p-1"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQuestion(index);
                          }}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 size={18} />
                        </button>
                        {isExpanded ? (
                          <ChevronUp size={20} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Question Details - Collapsible */}
                    {isExpanded && (
                      <div className="p-4 border-t border-gray-200 bg-slate-50/60 space-y-3">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Question Prompt:</span>
                          <p className="text-sm text-slate-800 font-medium leading-relaxed bg-white p-3 rounded-lg border border-slate-200">{q.question_text}</p>
                        </div>

                        {q.question_type === 'mcq' && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Options & Answer Key:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {parseOptions(q.options).map((option, optIndex) => {
                                const letter = String.fromCharCode(65 + optIndex);
                                const isCorrect = q.correct_answer === option;
                                return (
                                  <div
                                    key={optIndex}
                                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs transition-colors ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-semibold shadow-2xs'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                                          isCorrect
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-600 border border-slate-300'
                                        }`}
                                      >
                                        {letter}
                                      </span>
                                      <span className="truncate">{option}</span>
                                    </div>
                                    {isCorrect && (
                                      <Badge variant="success" className="text-[10px] py-0 px-1.5 flex-shrink-0">
                                        ✓ Correct Key
                                      </Badge>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {q.question_type === 'true_false' && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Correct Key:</span>
                            <div className="flex gap-2">
                              {['True', 'False'].map((val) => {
                                const isCorrect = String(q.correct_answer).toLowerCase() === val.toLowerCase();
                                return (
                                  <div
                                    key={val}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                                      isCorrect
                                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 shadow-2xs'
                                        : 'bg-white border-slate-200 text-slate-500'
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${isCorrect ? 'bg-emerald-600' : 'bg-slate-300'}`} />
                                    <span>{val}</span>
                                    {isCorrect && <span className="text-[10px] text-emerald-700">(Correct)</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {q.question_type === 'essay' && (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                            <span className="font-semibold block mb-0.5">Essay / Free Text Question</span>
                            <p className="text-amber-800">Students will write a text response. This question requires manual evaluation.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-800 mb-2">Exams Creation & Revision Workflow</h4>
        <div className="text-blue-700 text-sm space-y-1">
          <div>• <strong>Save as Draft:</strong> Save your quiz progress without submitting</div>
          <div>• <strong>Submit / Resubmit for Review:</strong> Submits the quiz to the moderator queue</div>
          <div>• <strong>Moderator Review:</strong> Moderator reviews questions, provides feedback, or approves</div>
          <div>• <strong>Admin Publish:</strong> Admin schedules and publishes approved quizzes for student cohorts</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={(e) => handleSubmit(e)}
          variant="secondary"
          disabled={loading || !title || (!isDynamicDraw && questions.length === 0)}
          className="w-full sm:w-auto"
        >
          {currentQuizObj?.status === 'rejected' ? 'Save Changes as Draft' : 'Save as Draft'}
        </Button>
        <Button
          onClick={(e) => handleSubmit(e, true)}
          variant="primary"
          disabled={loading || !title || (!isDynamicDraw && questions.length === 0)}
          className="w-full sm:w-auto"
        >
          {currentQuizObj?.status === 'rejected' ? 'Save & Resubmit for Review' : 'Submit for Review'}
        </Button>
      </div>

      {/* Professional Question Editor Modal */}
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

      {/* Import CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportFile(null);
        }}
        title="Import Questions from CSV"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 mb-2">CSV Format Instructions:</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <p>• Download the template to see the correct format</p>
              <p>• Question Types: <code>mcq</code>, <code>true_false</code>, <code>essay</code></p>
              <p>• For MCQ: Provide 4 options (A, B, C, D)</p>
              <p>• For True/False: Use <code>TRUE</code> and <code>FALSE</code> in options</p>
              <p>• For Essay: Leave options blank, provide answer key in correct answer</p>
              <p>• Marks must be a number (1, 2, 5, etc.)</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button
              variant="secondary"
              onClick={downloadQuestionTemplate}
              className="w-full md:w-auto flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Download Template
            </Button>
            <div className="flex-1 min-w-0">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>

          {importFile && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                Selected file: <strong>{importFile.name}</strong>
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Upload size={16} />
              Import Questions
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pick from Question Bank Modal */}
      <Modal
        isOpen={showBankPickerModal}
        onClose={() => setShowBankPickerModal(false)}
        title={`Select Questions from ${courses.find(c => c.id === selectedCourseId)?.code || 'Course'} Question Bank`}
      >
        <div className="space-y-4 max-h-[75vh] flex flex-col">
          {/* Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Search bank questions..."
              value={bankPickerSearch}
              onChange={(e) => setBankPickerSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            />
            <select
              value={bankPickerCategory}
              onChange={(e) => setBankPickerCategory(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="all">All Categories</option>
              {courseCategories.map((c) => (
                <option key={c.id} value={c.prefix}>
                  [{c.prefix}] {c.name}
                </option>
              ))}
              <option value="uncategorized">General / Uncategorized</option>
            </select>
            <select
              value={bankPickerDifficulty}
              onChange={(e) => setBankPickerDifficulty(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy (Pass Rate ≥80%)</option>
              <option value="medium">Medium (40-79%)</option>
              <option value="hard">Hard (&lt;40%)</option>
            </select>
            <select
              value={bankPickerTopic}
              onChange={(e) => setBankPickerTopic(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
            >
              <option value="all">All Topics</option>
              {Array.from(new Set(bankQuestions.map(q => q.topic || 'General'))).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* List */}
          {loadingBankQuestions ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              Loading questions from course bank...
            </div>
          ) : (
            (() => {
              const filtered = bankQuestions.filter(q => {
                const matchSearch = !bankPickerSearch || q.question_text.toLowerCase().includes(bankPickerSearch.toLowerCase());
                const matchDiff = bankPickerDifficulty === 'all' || q.difficulty === bankPickerDifficulty;
                const matchTopic = bankPickerTopic === 'all' || (q.topic || 'General') === bankPickerTopic;
                const matchCat = bankPickerCategory === 'all' || 
                  (bankPickerCategory === 'uncategorized' 
                    ? (!q.category_prefix && (!q.category || q.category === 'General'))
                    : (q.category_prefix === bankPickerCategory || q.category === bankPickerCategory));
                return matchSearch && matchDiff && matchTopic && matchCat;
              });

              return (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-600 border-b pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={filtered.length > 0 && filtered.every(q => selectedBankQuestionIds.has(q.id))}
                          onChange={() => handleSelectAllBankQuestions(filtered)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>Select All Filtered ({filtered.length})</span>
                      </label>
                      {bankPickerTopic !== 'all' && (
                        <button
                          type="button"
                          onClick={() => {
                            const topicQuestions = bankQuestions.filter(q => (q.topic || 'General') === bankPickerTopic);
                            setSelectedBankQuestionIds(prev => {
                              const next = new Set(prev);
                              topicQuestions.forEach(q => next.add(q.id));
                              return next;
                            });
                          }}
                          className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 transition-colors"
                        >
                          + Select Topic: "{bankPickerTopic}"
                        </button>
                      )}
                    </div>
                    <span className="font-semibold text-blue-600">
                      {selectedBankQuestionIds.size} selected
                    </span>
                  </div>

                  <div className="overflow-y-auto space-y-2 flex-1 max-h-[45vh] pr-1">
                    {filtered.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-xs">No questions found matching your filter</p>
                    ) : (
                      filtered.map((item, i) => {
                        const isSelected = selectedBankQuestionIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleToggleSelectBankQuestion(item.id)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 ${
                              isSelected ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-300' : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectBankQuestion(item.id)}
                              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-gray-400">#{i + 1}</span>
                                <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium text-[11px]">{item.topic || 'General'}</span>
                                {(item.category_prefix || (item.category && item.category !== 'General')) && (
                                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] border uppercase ${
                                    getCategoryColorBadgeClasses(courseCategories.find(c => c.prefix === item.category_prefix)?.color)
                                  }`}>
                                    [{item.category_prefix || item.category}]
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 rounded font-medium text-[11px] ${
                                  item.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-800' :
                                  item.difficulty === 'hard' ? 'bg-rose-100 text-rose-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {item.difficulty}
                                </span>
                                <span className="text-gray-400">({item.marks || 1} mark)</span>
                              </div>
                              <p className="font-medium text-gray-900 leading-snug">{item.question_text}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowBankPickerModal(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleImportSelectedFromBank}
                      disabled={selectedBankQuestionIds.size === 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Plus size={16} />
                      <span>Add Selected ({selectedBankQuestionIds.size}) to Quiz</span>
                    </Button>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </Modal>

      {/* Cohort Session Management Modal */}
      {id && (
        <QuizSessionManagerModal
          isOpen={showSessionModal}
          onClose={() => setShowSessionModal(false)}
          quiz={currentQuizObj || ({ id, title, course_id: selectedCourseId, lecturer_id: user?.id || '' } as Quiz)}
        />
      )}
    </div>
  );
}
