import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Edit2, AlertCircle } from 'lucide-react';
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
  const { id } = useParams<{ id?: string }>();
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
  const [questions, setQuestions] = useState<QuestionForm[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<QuestionForm>({
    question_text: '',
    question_type: 'mcq',
    options: ['', '', '', ''],
    correct_answer: '',
    marks: 1,
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Load quiz data if in edit mode
  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      loadQuizData(id);
    }
  }, [id]);

  const loadQuizData = async (quizId: string) => {
    try {
      setLoading(true);
      const quiz = await db.getQuiz(quizId);
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

      // Load questions
      const quizQuestions = await db.getQuestions(quizId);
      const formattedQuestions = quizQuestions.map(q => {
        let options;
        
        if (q.options) {
          console.log(`Raw options for question ${q.id}:`, q.options);
          console.log(`Type of options:`, typeof q.options);
          
          // Handle different data types for options
          if (Array.isArray(q.options)) {
            // Options are already an array (from database parsing)
            options = q.options;
          } else if (typeof q.options === 'string') {
            // Options are a JSON string (need to parse)
            try {
              options = JSON.parse(q.options);
            } catch (error) {
              console.warn('Failed to parse options string for question:', q.id, error);
              // Try to fix common JSON issues
              try {
                const cleaned = q.options.replace(/[^[\]"\w\s\.,-]+$/g, '');
                options = JSON.parse(cleaned);
                console.log('Successfully parsed after cleaning:', options);
              } catch (cleanError) {
                console.warn('Cleaning also failed, using default options');
                options = ['', '', '', ''];
              }
            }
          } else {
            console.warn('Unexpected options type for question:', q.id, typeof q.options);
            options = ['', '', '', ''];
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
    setCurrentQuestion(questions[index]);
    setEditIndex(index);
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent, status: 'draft' | 'published') => {
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
          status,
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

        for (const question of questionsToInsert) {
          await db.createQuestion(question);
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
          status,
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

      <Card>
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
          <Button onClick={() => setShowQuestionModal(true)}>
            <Plus size={18} className="mr-2" />
            Add Question
          </Button>
        </div>

        {questions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No questions added yet</p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-lg p-4 flex items-start justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">Q{index + 1}.</span>
                    <Badge variant="secondary">{q.question_type}</Badge>
                    <Badge variant="primary">{q.marks} marks</Badge>
                  </div>
                  <p className="text-gray-700">{q.question_text}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditQuestion(index)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        <Button
          onClick={(e) => handleSubmit(e, 'draft')}
          variant="secondary"
          disabled={loading || !title || questions.length === 0}
        >
          Save as Draft
        </Button>
        <Button
          onClick={(e) => handleSubmit(e, 'published')}
          disabled={loading || !title || questions.length === 0}
        >
          Publish Quiz
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

        <div className="flex justify-end gap-3 mt-6">
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
    </div>
  );
}
