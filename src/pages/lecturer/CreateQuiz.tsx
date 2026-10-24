import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookOpen, Users, CheckCircle, Edit2, AlertCircle, TrendingUp, Clock, Award, Target, BarChart3, Calendar, FileText, Eye, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, Download, Upload, Shield, Video, Monitor, Lock, Shuffle } from 'lucide-react';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { db, Question, Course, Quiz } from '../../lib/database';
import { parseOptions } from '../../utils/quizUtils';
import { useAuth } from '../../contexts/AuthContext';
import QuizSessionManagerModal from '../../components/lecturer/QuizSessionManagerModal';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isDynamicDraw, setIsDynamicDraw] = useState(false);
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
    const template = [
      'Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks',
      'mcq,"What is 2+2?","3","4","5","6","B",1',
      'mcq,"What is the capital of France?","London","Berlin","Paris","Madrid","C",2',
      'true_false,"The Earth is round.","TRUE","FALSE","TRUE","FALSE","A",1',
      'essay,"Explain the importance of photosynthesis.",,,,,,"Write your answer here",5',
      'mcq,"What is the largest planet?","Mars","Jupiter","Saturn","Earth","B",1'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'question_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    URL.revokeObjectURL(url);
  };

  // CSV Export Function
  const exportQuestionsToCSV = () => {
    if (questions.length === 0) {
      alert('No questions to export');
      return;
    }

    const header = 'Question Type,Question Text,Option A,Option B,Option C,Option D,Correct Answer,Marks';
    const rows = questions.map(q => {
      // Helper to escape quotes and wrap in quotes if necessary
      const escape = (str: string | number) => {
        const s = String(str);
        if (s.includes('"') || s.includes(',') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const type = escape(q.question_type);
      const text = escape(q.question_text);
      const optA = escape(q.options[0] || '');
      const optB = escape(q.options[1] || '');
      const optC = escape(q.options[2] || '');
      const optD = escape(q.options[3] || '');
      const answer = escape(q.correct_answer);
      const marks = escape(q.marks);

      return `${type},${text},${optA},${optB},${optC},${optD},${answer},${marks}`;
    });

    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${title ? title.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'quiz'}_questions.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Import Function
  const importQuestionsFromCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;

      // Parse entire CSV text using robust character-by-character parser
      const parseCSV = (csvText: string): string[][] => {
        const result: string[][] = [];
        let row: string[] = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];

          if (inQuotes) {
            if (char === '"') {
              if (nextChar === '"') {
                field += '"';
                i++; // skip next char
              } else {
                inQuotes = false;
              }
            } else {
              field += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              row.push(field);
              field = '';
            } else if (char === '\n' || char === '\r') {
              row.push(field);
              field = '';
              if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
                result.push(row);
              }
              row = [];
              if (char === '\r' && nextChar === '\n') {
                i++;
              }
            } else {
              field += char;
            }
          }
        }

        if (field !== '' || row.length > 0) {
          row.push(field);
          result.push(row);
        }

        return result;
      };

      const rows = parseCSV(text);
      if (rows.length === 0) {
        alert('The CSV file is empty.');
        return;
      }

      // Check if first row is header
      const hasHeader = rows[0][0] && rows[0][0].toLowerCase().includes('question type');
      const startIndex = hasHeader ? 1 : 0;

      const importedQuestions: QuestionForm[] = [];

      for (let i = startIndex; i < rows.length; i++) {
        const fields = rows[i].map(f => f.trim());
        if (fields.length === 0 || (fields.length === 1 && fields[0] === '')) continue;

        if (fields.length >= 8) {
          const [
            questionType,
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer,
            marksStr
          ] = fields;

          // Validate question type
          if (!['mcq', 'true_false', 'essay'].includes(questionType.toLowerCase())) {
            console.warn(`Invalid question type at row ${i + 1}: ${questionType}`);
            continue;
          }

          // Parse marks
          const marks = parseInt(marksStr) || 1;

          // Create question object
          const question: QuestionForm = {
            question_text: questionText,
            question_type: questionType.toLowerCase() as 'mcq' | 'true_false' | 'essay',
            options: [
              optionA,
              optionB,
              optionC,
              optionD
            ],
            correct_answer: correctAnswer,
            marks: marks
          };

          importedQuestions.push(question);
        } else if (fields.length >= 3) {
          // Support for true_false and essay questions that may not have all 8 columns
          const [questionType, questionText, ...rest] = fields;
          const type = questionType.toLowerCase();

          if (type === 'true_false' || type === 'essay') {
            const marksStr = fields[fields.length - 1];
            const marks = parseInt(marksStr) || 1;
            const correctAnswer = type === 'true_false' ? fields[fields.length - 2] : '';

            const question: QuestionForm = {
              question_text: questionText,
              question_type: type as 'true_false' | 'essay',
              options: type === 'true_false' ? ['True', 'False', '', ''] : ['', '', '', ''],
              correct_answer: correctAnswer,
              marks: marks
            };
            importedQuestions.push(question);
          }
        }
      }

      if (importedQuestions.length > 0) {
        setQuestions(prev => [...prev, ...importedQuestions]);
        setShowImportModal(false);
        setImportFile(null);
        alert(`Successfully imported ${importedQuestions.length} questions!`);
      } else {
        alert('No valid questions found in the CSV file. Please check the format.');
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
      db.getCourses(user.id).then(data => {
        setCourses(data as Course[]);
      }).catch(err => console.error('Error fetching courses in CreateQuiz:', err));
    }
  }, [user]);

  // Load question bank stats when course is selected
  useEffect(() => {
    if (selectedCourseId) {
      db.getQuestionBankStats(selectedCourseId).then(stats => {
        setBankStats(stats);
      }).catch(err => console.error('Error fetching course bank stats:', err));
    } else {
      setBankStats(null);
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

  const handleOpenBankPicker = async () => {
    if (!selectedCourseId) {
      alert('Please select an Institutional Course first.');
      return;
    }
    setShowBankPickerModal(true);
    setLoadingBankQuestions(true);
    setSelectedBankQuestionIds(new Set());
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
        if (q.options) {
          try {
            // Handle different question types
            if (q.question_type === 'mcq') {
              // For MCQ, parse JSON options
              const optionsString = q.options.toString().trim();
              console.log('MCQ options string:', optionsString);

              if (optionsString && optionsString !== '[]') {
                options = JSON.parse(optionsString);
              } else {
                options = ['', '', '', ''];
              }
            } else if (q.question_type === 'true_false') {
              // For True/False, use default options
              options = ['True', 'False'];
            } else {
              // For Essay questions, use empty options
              options = ['', '', '', ''];
            }
          } catch (error) {
            console.error('Error parsing options for question type:', q.question_type);
            console.error('Options string that failed:', q.options);

            // Fallback based on question type
            if (q.question_type === 'mcq') {
              options = ['', '', '', ''];
            } else if (q.question_type === 'true_false') {
              options = ['True', 'False'];
            } else {
              options = ['', '', '', ''];
            }
          }
        } else {
          options = ['', '', '', ''];
        }

        return {
          question_text: q.question_text,
          question_type: q.question_type as 'mcq' | 'true_false' | 'essay',
          options: options,
          correct_answer: q.correct_answer || '',
          marks: q.marks
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

  const handleAddQuestion = () => {
    setValidationError('');

    if (!currentQuestion.question_text.trim()) {
      setValidationError('Question text is required');
      return;
    }

    if (currentQuestion.question_type === 'mcq') {
      const validOptions = currentQuestion.options.filter(opt => opt.trim());
      if (validOptions.length < 2) {
        setValidationError('MCQ questions need at least 2 options');
        return;
      }
      if (!currentQuestion.correct_answer) {
        setValidationError('Please select the correct answer');
        return;
      }
    } else if (currentQuestion.question_type === 'true_false') {
      if (!currentQuestion.correct_answer) {
        setValidationError('Please select the correct answer (True or False)');
        return;
      }
    }

    if (editIndex !== null) {
      const updated = [...questions];
      updated[editIndex] = currentQuestion;
      setQuestions(updated);
      setEditIndex(null);
    } else {
      setQuestions([...questions, currentQuestion]);
    }

    setCurrentQuestion({
      question_text: '',
      question_type: 'mcq',
      options: ['', '', '', ''],
      correct_answer: '',
      marks: 1,
    });
    setShowQuestionModal(false);
  };

  const handleEditQuestion = (index: number) => {
    console.log('Editing question at index:', index);
    console.log('Question to edit:', questions[index]);
    console.log('All questions:', questions);
    setCurrentQuestion(questions[index]);
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
      const count = parseInt(drawQuestionCount);
      if (!count || count < 1) {
        setValidationError('Please specify how many questions to draw per student (at least 1)');
        return;
      }
      if (bankStats && bankStats.active < count) {
        setValidationError(`The active bank for this course only has ${bankStats.active} questions, but you requested ${count}. Please reduce question count or add more questions to the bank.`);
        return;
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

      const totalMarks = isDynamicDraw 
        ? (parseInt(drawQuestionCount) || 25) * 1
        : questions.reduce((sum, q) => sum + q.marks, 0);

      const quizPayload = {
        course_id: selectedCourseId || null,
        title,
        description,
        subject,
        duration_minutes: durationNum,
        total_marks: totalMarks,
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
        draw_question_count: isDynamicDraw ? (parseInt(drawQuestionCount) || 25) : 0,
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
            <div className="space-y-3 pt-3 border-t border-purple-200/60">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Number of Questions to Draw per Student
                </label>
                <input
                  type="number"
                  min="1"
                  max={bankStats ? bankStats.active : 100}
                  value={drawQuestionCount}
                  onChange={(e) => setDrawQuestionCount(e.target.value)}
                  className="w-full max-w-xs px-3 py-1.5 border border-purple-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Each student receives {drawQuestionCount || 0} unique questions sampled upon exam start.
                </p>
              </div>

              {bankStats && (
                <div className="p-3 bg-white rounded-lg border border-purple-200 text-xs text-gray-700 flex flex-wrap gap-4 items-center">
                  <div>
                    <span className="font-medium text-gray-500">Course Bank Size:</span>{' '}
                    <strong className="text-gray-900">{bankStats.active} Active Questions</strong>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 font-semibold">{bankStats.easy} Easy</span>
                    <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 font-semibold">{bankStats.medium} Med</span>
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">{bankStats.hard} Hard</span>
                  </div>
                </div>
              )}

              {!selectedCourseId && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Please select an Institutional Course above to draw from its Question Bank.
                </p>
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
              <h3 className="text-lg font-bold text-gray-900">Dynamic Bank Draw Active</h3>
              <p className="text-sm text-gray-600 max-w-lg mx-auto mt-1">
                This exam will draw <strong>{drawQuestionCount} questions</strong> dynamically from the{' '}
                <strong>{courses.find(c => c.id === selectedCourseId)?.code || 'Course'} Question Bank</strong> for each student.
                {hasMultipleSessions && ' Cohort sessions will receive non-overlapping pools with equal difficulty distributions.'}
              </p>
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
                      <div className="p-4 border-t border-gray-200 bg-white">
                        <div className="space-y-3">
                          <div>
                            <h5 className="font-medium text-gray-900 mb-2">Question Text:</h5>
                            <p className="text-gray-700">{q.question_text}</p>
                          </div>

                          {q.question_type === 'mcq' && q.options && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Options:</h5>
                              <div className="space-y-1">
                                {q.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex items-center gap-2">
                                    <span className="text-gray-600">
                                      {String.fromCharCode(65 + optIndex)}.
                                    </span>
                                    <span className="text-gray-700">{option}</span>
                                    {q.correct_answer === option && (
                                      <Badge variant="success" className="ml-2">Correct</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {q.question_type === 'true_false' && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Options:</h5>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">A.</span>
                                  <span className="text-gray-700">True</span>
                                  {q.correct_answer === 'True' && (
                                    <Badge variant="success" className="ml-2">Correct</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-600">B.</span>
                                  <span className="text-gray-700">False</span>
                                  {q.correct_answer === 'False' && (
                                    <Badge variant="success" className="ml-2">Correct</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {q.question_type === 'essay' && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-2">Essay Question:</h5>
                              <p className="text-gray-600 italic">This is an essay question. Students will provide written answers.</p>
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

      <Modal
        isOpen={showQuestionModal}
        onClose={() => {
          setShowQuestionModal(false);
          setEditIndex(null);
          setCurrentQuestion({
            question_text: '',
            question_type: 'mcq',
            options: ['', '', '', ''],
            correct_answer: '',
            marks: 1,
          });
        }}
        title={editIndex !== null ? 'Edit Question' : 'Add Question'}
        size="lg"
      >
        <div className="space-y-4">
          {validationError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 flex gap-2">
              <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-red-700 text-sm">{validationError}</p>
            </div>
          )}

          <Select
            label="Question Type"
            value={currentQuestion.question_type}
            onChange={(e) => {
              setValidationError('');
              setCurrentQuestion({
                ...currentQuestion,
                question_type: e.target.value as any,
                correct_answer: '',
              });
            }}
            options={[
              { value: 'mcq', label: 'Multiple Choice' },
              { value: 'true_false', label: 'True/False' },
              { value: 'essay', label: 'Essay' },
            ]}
          />

          <Textarea
            label="Question Text"
            value={currentQuestion.question_text}
            onChange={(e) =>
              setCurrentQuestion({ ...currentQuestion, question_text: e.target.value })
            }
            rows={3}
            required
          />

          {currentQuestion.question_type === 'mcq' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Options</label>
                <span className="text-xs text-gray-500">
                  Correct answer: {currentQuestion.correct_answer ? '✓ Selected' : '(select one)'}
                </span>
              </div>
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex gap-2 p-3 border rounded-lg transition-colors ${currentQuestion.correct_answer === option
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                    }`}
                >
                  <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                    <input
                      type="radio"
                      name="correct"
                      checked={currentQuestion.correct_answer === option}
                      onChange={() =>
                        setCurrentQuestion({ ...currentQuestion, correct_answer: option })
                      }
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="text-sm text-gray-600">Mark as correct</span>
                  </label>
                  <Input
                    value={option}
                    onChange={(e) => {
                      const newOptions = [...currentQuestion.options];
                      newOptions[index] = e.target.value;
                      setCurrentQuestion({ ...currentQuestion, options: newOptions });
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    className="flex-1 min-w-0"
                  />
                </div>
              ))}
            </div>
          )}

          {currentQuestion.question_type === 'true_false' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Select the Correct Answer
              </label>
              <div className="grid grid-cols-2 gap-3">
                {['true', 'false'].map((value) => (
                  <label
                    key={value}
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${currentQuestion.correct_answer === value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                      }`}
                  >
                    <input
                      type="radio"
                      name="correct_tf"
                      value={value}
                      checked={currentQuestion.correct_answer === value}
                      onChange={() =>
                        setCurrentQuestion({ ...currentQuestion, correct_answer: value })
                      }
                      className="w-4 h-4 accent-green-600"
                    />
                    <span className="font-medium capitalize">{value}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Input
            label="Marks"
            type="number"
            value={currentQuestion.marks.toString()}
            onChange={(e) =>
              setCurrentQuestion({ ...currentQuestion, marks: parseInt(e.target.value) || 1 })
            }
            min="1"
          />
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6 mb-4">
          <Button
            variant="secondary"
            onClick={() => {
              setShowQuestionModal(false);
              setEditIndex(null);
              setValidationError('');
            }}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={handleAddQuestion} className="w-full sm:w-auto">
            {editIndex !== null ? 'Update' : 'Add'} Question
          </Button>
        </div>
      </Modal>

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Search bank questions..."
              value={bankPickerSearch}
              onChange={(e) => setBankPickerSearch(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-xs"
            />
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
                return matchSearch && matchDiff && matchTopic;
              });

              return (
                <>
                  <div className="flex items-center justify-between text-xs text-gray-600 border-b pb-2">
                    <label className="flex items-center gap-2 cursor-pointer font-medium">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every(q => selectedBankQuestionIds.has(q.id))}
                        onChange={() => handleSelectAllBankQuestions(filtered)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                      <span>Select All Available ({filtered.length})</span>
                    </label>
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
