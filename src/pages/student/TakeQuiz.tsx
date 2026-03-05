import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { db, Quiz, Question, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export default function TakeQuiz() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadQuiz();
  }, [id]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const loadQuiz = async () => {
    if (!id || !user) return;

    // Get quiz
    const quizzes = await db.getQuizzes();
    const quizData = quizzes.find(q => q.id === id);
    
    if (quizData) {
      // Check if deadline has passed
      if (quizData.deadline && new Date(quizData.deadline) < new Date()) {
        alert('This quiz has expired and is no longer available.');
        navigate('/student/available-quizzes');
        return;
      }
      
      setQuiz(quizData as Quiz);
      setTimeLeft(quizData.duration_minutes * 60);
    }

    // Get questions
    const questionsData = await db.getQuestions(id);
    setQuestions(questionsData as Question[]);

    // Check for existing attempts
    const existingAttempts = await db.getQuizAttempts(id, user.id);
    const inProgressAttempt = existingAttempts.find(a => a.status === 'in_progress');
    const completedAttempt = existingAttempts.find(a => a.status === 'submitted' || a.status === 'graded');

    if (completedAttempt) {
      // Student has already submitted this quiz
      alert('You have already submitted this quiz. You cannot take it again.');
      navigate('/student/available-quizzes');
      return;
    }

    // Clean up: if there's an old in_progress attempt (e.g., from a previous session > 1 day old), 
    // mark it as abandoned and create a fresh attempt
    if (inProgressAttempt) {
      const attemptAgeMs = Date.now() - new Date(inProgressAttempt.started_at).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;

      if (attemptAgeMs > oneDayMs) {
        // Old attempt; don't resume it, create fresh
        const newAttempt = await db.createQuizAttempt({
          quiz_id: id,
          student_id: user.id,
          started_at: new Date().toISOString(),
          status: 'in_progress',
        });
        setAttemptId(newAttempt.id);
      } else {
        // Recent in_progress attempt; resume it
        setAttemptId(inProgressAttempt.id);
        const existingAnswers = await db.getStudentAnswers(inProgressAttempt.id);
        const answerMap: any = {};
        existingAnswers.forEach(a => {
          answerMap[a.question_id] = a.answer_text;
        });
        setAnswers(answerMap);
      }
    } else {
      // No existing attempt; create new one
      const newAttempt = await db.createQuizAttempt({
        quiz_id: id,
        student_id: user.id,
        started_at: new Date().toISOString(),
        status: 'in_progress',
      });
      setAttemptId(newAttempt.id);
    }
  };

  const handleAnswerChange = async (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });

    if (attemptId) {
      const existing = await db.getStudentAnswers(attemptId, questionId);
      
      if (existing.length > 0) {
        await db.updateStudentAnswer(existing[0].id, { answer_text: answer });
      } else {
        await db.createStudentAnswer({
          attempt_id: attemptId,
          question_id: questionId,
          answer_text: answer,
          is_correct: null,
          marks_obtained: null,
          lecturer_comment: '',
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;

    // Check if deadline has passed before submitting
    if (quiz?.deadline && new Date(quiz.deadline) < new Date()) {
      alert('The deadline for this quiz has passed. Your submission cannot be accepted.');
      navigate('/student/available-quizzes');
      return;
    }

    setLoading(true);

    try {
      let totalMarksObtained = 0;

      for (const question of questions) {
        const answer = answers[question.id];
        if (question.question_type !== 'essay') {
          const isCorrect = answer === question.correct_answer;
          const marksObtained = isCorrect ? question.marks : 0;
          totalMarksObtained += marksObtained;

          const studentAnswers = await db.getStudentAnswers(attemptId, question.id);
          if (studentAnswers.length > 0) {
            await db.updateStudentAnswer(studentAnswers[0].id, {
              is_correct: isCorrect,
              marks_obtained: marksObtained,
            });
          }
        }
      }

      // Calculate and save the total score as percentage
      const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0);
      const scorePercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
      
      console.log('Submitting quiz with:', {
        attemptId,
        totalMarksObtained,
        totalPossibleMarks,
        scorePercentage,
      });
      
      // determine if any essay questions need manual grading
      const hasEssay = questions.some(q => q.question_type === 'essay');
      const newStatus: 'submitted' | 'graded' = hasEssay ? 'submitted' : 'graded';

      const updateData: any = {
        submitted_at: new Date().toISOString(),
        status: newStatus,
        score: scorePercentage,
      };
      if (!hasEssay) {
        // auto-graded; mark graded_at timestamp immediately
        updateData.graded_at = new Date().toISOString();
      }

      const updateResult = await db.updateQuizAttempt(attemptId, updateData);
      console.log('Update result:', updateResult);

      navigate('/student/attempts');
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Failed to submit quiz');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!quiz || questions.length === 0) {
    return <div>Loading...</div>;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {quiz.deadline && (
        <Card className="bg-orange-50 border-orange-200">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertCircle size={20} />
            <span className="font-medium">
              Deadline: {new Date(quiz.deadline).toLocaleString()}
            </span>
          </div>
        </Card>
      )}
      
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-sm text-gray-600">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-2 text-lg font-bold text-blue-600">
            <Clock size={24} />
            {formatTime(timeLeft)}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Question {currentIndex + 1}
              </h2>
              <span className="text-sm text-gray-600">{currentQuestion.marks} marks</span>
            </div>
            <p className="text-gray-900">{currentQuestion.question_text}</p>
          </div>

          {currentQuestion.question_type === 'mcq' && (
            <div className="space-y-3">
              {(() => {
                let options: string[];
                try {
                  if (Array.isArray(currentQuestion.options)) {
                    options = currentQuestion.options as string[];
                  } else if (currentQuestion.options && typeof currentQuestion.options === 'string') {
                    options = JSON.parse(currentQuestion.options);
                  } else {
                    options = [];
                  }
                } catch (error) {
                  console.warn('Failed to parse options for question:', currentQuestion.id, error);
                  options = [];
                }
                
                return options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                  >
                    <input
                      type="radio"
                      name={`question-${currentQuestion.id}`}
                      value={option}
                      checked={answers[currentQuestion.id] === option}
                      onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                      className="w-4 h-4"
                    />
                    <span className="flex-1">{option}</span>
                  </label>
                ));
              })()}
            </div>
          )}

          {currentQuestion.question_type === 'true_false' && (
            <div className="space-y-3">
              {['true', 'false'].map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option}
                    checked={answers[currentQuestion.id] === option}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 capitalize">{option}</span>
                </label>
              ))}
            </div>
          )}

          {currentQuestion.question_type === 'essay' && (
            <Textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
              rows={8}
              placeholder="Type your answer here..."
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mark-review"
              checked={markedForReview.has(currentIndex)}
              onChange={(e) => {
                const newMarked = new Set(markedForReview);
                if (e.target.checked) {
                  newMarked.add(currentIndex);
                } else {
                  newMarked.delete(currentIndex);
                }
                setMarkedForReview(newMarked);
              }}
              className="w-4 h-4"
            />
            <label htmlFor="mark-review" className="text-sm text-gray-700">
              Mark for review
            </label>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={18} className="mr-1" />
          Previous
        </Button>

        <div className="flex gap-2">
          {questions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                index === currentIndex
                  ? 'bg-blue-600 text-white'
                  : answers[questions[index].id]
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-200 text-gray-700'
              } ${markedForReview.has(index) ? 'ring-2 ring-yellow-500' : ''}`}
            >
              {index + 1}
            </button>
          ))}
        </div>

        {currentIndex === questions.length - 1 ? (
          <Button onClick={() => setShowSubmitModal(true)}>
            Submit Quiz
          </Button>
        ) : (
          <Button onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}>
            Next
            <ChevronRight size={18} className="ml-1" />
          </Button>
        )}
      </div>

      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Quiz"
      >
        <p className="text-gray-700">
          Are you sure you want to submit your quiz? You won't be able to change your answers after submission.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Answered: {Object.keys(answers).length} of {questions.length}
        </p>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
