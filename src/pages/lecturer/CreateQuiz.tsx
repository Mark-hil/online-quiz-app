import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, BookOpen, Users, CheckCircle, Edit2, AlertCircle, TrendingUp, Clock, Award, Target, BarChart3, Calendar, FileText, Eye, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, Download, Upload } from 'lucide-react';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { db, Question } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

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
  const [duration, setDuration] = useState('60');
  const [deadline, setDeadline] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [randomizeOptions, setRandomizeOptions] = useState(false);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Partial<Question>>({
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

  // CSV Import Function
  const importQuestionsFromCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header if present
      const startIndex = lines[0].toLowerCase().includes('question type') ? 1 : 0;
      
      const importedQuestions: QuestionForm[] = [];
      
      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse CSV (simple parser - handles quoted fields)
        const fields = parseCSVLine(line);
        
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
          
          // Debug logging
          console.log('CSV Line:', line);
          console.log('Parsed Fields:', fields);
          console.log('Correct Answer Field:', correctAnswer);
          
          // Validate question type
          if (!['mcq', 'true_false', 'essay'].includes(questionType.toLowerCase())) {
            console.warn(`Invalid question type at line ${i + 1}: ${questionType}`);
            continue;
          }
          
          // Parse marks
          const marks = parseInt(marksStr) || 1;
          
          // Create question object
          const question: QuestionForm = {
            question_text: questionText.replace(/^"|"$/g, '').trim(),
            question_type: questionType.toLowerCase() as 'mcq' | 'true_false' | 'essay',
            options: [
              optionA.replace(/^"|"$/g, '').trim(),
              optionB.replace(/^"|"$/g, '').trim(),
              optionC.replace(/^"|"$/g, '').trim(),
              optionD.replace(/^"|"$/g, '').trim()
            ],
            correct_answer: correctAnswer.replace(/^"|"$/g, '').trim(),
            marks: marks
          };
          
          console.log('Created Question:', question);
          importedQuestions.push(question);
        }
      }
      
      if (importedQuestions.length > 0) {
        console.log('Questions before import:', questions);
        console.log('Questions to import:', importedQuestions);
        setQuestions(prev => {
          const newQuestions = [...prev, ...importedQuestions];
          console.log('Questions after import:', newQuestions);
          return newQuestions;
        });
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

  // Simple CSV parser (handles quoted fields)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
      i++;
    }
    
    result.push(current.trim());
    return result;
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

      // Set quiz details
      setTitle(quiz.title);
      setDescription(quiz.description || '');
      setSubject(quiz.subject);
      setDuration(quiz.duration_minutes.toString());
      setRandomizeQuestions(quiz.randomize_questions || false);
      setRandomizeOptions(quiz.randomize_options || false);
      setShowResultsImmediately(quiz.show_results_immediately !== false);
      setAllowReview(quiz.allow_review !== false);
      
      if (quiz.deadline) {
        const deadline = new Date(quiz.deadline);
        setDeadlineDate(deadline.toISOString().split('T')[0]);
        setDeadlineTime(deadline.toTimeString().slice(0, 5));
      }

      // Load questions separately
      const quizQuestions = await db.getQuestions(quizId);
      console.log('Quiz questions loaded:', quizQuestions);
      const formattedQuestions = quizQuestions.map(q => {
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

    if (questions.length === 0) {
      setValidationError('At least one question is required');
      return;
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
      
      const totalMarks = questions.reduce((sum, q) => sum + q.marks, 0);

      if (isEditMode && id) {
        // Update existing quiz
        await db.updateQuiz(id, {
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
        });

        // Delete existing questions and recreate them
        const existingQuestions = await db.getQuestions(id);
        for (const question of existingQuestions) {
          await db.deleteQuestion(question.id);
        }

        // Insert updated questions
        const questionsToInsert = questions.map(q => ({
          quiz_id: id,
          lecturer_id: user.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === 'mcq' ? JSON.stringify(q.options) : '[]',
          correct_answer: q.correct_answer,
          marks: q.marks,
        }));

        console.log('Questions to insert:', questionsToInsert);

        for (const question of questionsToInsert) {
          console.log('Creating question:', question);
          const result = await db.createQuestion(question);
          console.log('Question created result:', result);
        }
      } else {
        // Create new quiz
        const quiz = await db.createQuiz({
          lecturer_id: user.id,
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
        });

        const questionsToInsert = questions.map(q => ({
          quiz_id: quiz.id,
          lecturer_id: user.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.question_type === 'mcq' ? JSON.stringify(q.options) : '[]',
          correct_answer: q.correct_answer,
          marks: q.marks,
        }));

        // Insert questions one by one
        for (const question of questionsToInsert) {
          await db.createQuestion(question);
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
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditMode ? 'Edit Quiz' : 'Create New Quiz'}
      </h1>

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
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Mathematics"
            />

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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quiz Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
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

              <div className="flex items-center justify-between">
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

              <div className="flex items-center justify-between">
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

              <div className="flex items-center justify-between">
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
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Questions ({questions.length})
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              onClick={downloadQuestionTemplate}
              className="flex items-center gap-2"
            >
              <Download size={18} />
              Download Template
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2"
            >
              <Upload size={18} />
              Import CSV
            </Button>
            <Button onClick={() => setShowQuestionModal(true)}>
              <Plus size={18} className="mr-2" />
              Add Question
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
                    <div className="flex items-center gap-2 flex-1">
                      <span className="font-medium">Q{index + 1}.</span>
                      <Badge variant="secondary">{q.question_type}</Badge>
                      <Badge variant="primary">{q.marks} marks</Badge>
                      <p className="text-gray-700 truncate max-w-md">{q.question_text}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditQuestion(index);
                        }}
                        className="text-blue-600 hover:text-blue-700 p-1"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-blue-800 mb-2">Quiz Creation Workflow</h4>
        <div className="text-blue-700 text-sm space-y-1">
          <div>• <strong>Save as Draft:</strong> Create your quiz and save it as a draft</div>
          <div>• <strong>Submit for Review:</strong> Submit quiz directly for moderator review</div>
          <div>• <strong>Moderator Review:</strong> Moderator will review questions and approve/reject</div>
          <div>• <strong>Admin Publish:</strong> Admin will publish approved quizzes for students</div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={(e) => handleSubmit(e)}
          variant="secondary"
          disabled={loading || !title || questions.length === 0}
        >
          Save as Draft
        </Button>
        <Button
          onClick={(e) => handleSubmit(e, true)}
          variant="primary"
          disabled={loading || !title || questions.length === 0}
        >
          Submit for Review
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
                  className={`flex gap-2 p-3 border rounded-lg transition-colors ${
                    currentQuestion.correct_answer === option
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
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
                    className="flex-1"
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
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      currentQuestion.correct_answer === value
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

        <div className="flex justify-end gap-3 mt-6 mb-4">
          <Button
            variant="secondary"
            onClick={() => {
              setShowQuestionModal(false);
              setEditIndex(null);
              setValidationError('');
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleAddQuestion}>
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

          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={downloadQuestionTemplate}
              className="flex items-center gap-2"
            >
              <Download size={16} />
              Download Template
            </Button>
            <div className="flex-1">
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

          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!importFile}
              className="flex items-center gap-2"
            >
              <Upload size={16} />
              Import Questions
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
