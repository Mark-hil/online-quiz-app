import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, ChevronLeft, ChevronRight, Flag, AlertCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Textarea from '../../components/ui/Textarea';
import { db, Quiz, Question, QuizAttempt } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { parseOptions } from '../../utils/quizUtils';

export default function TakeQuiz() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [markedForReview, setMarkedForReview] = useState<Set<number>>(new Set());
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [windowFocus, setWindowFocus] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [copyAttempts, setCopyAttempts] = useState(0);
  const [rightClickCount, setRightClickCount] = useState(0);
  const [quizTerminated, setQuizTerminated] = useState(false);
  const [terminationReason, setTerminationReason] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [completedAttemptData, setCompletedAttemptData] = useState<any>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get flagged questions for navigation
  const getFlaggedQuestions = () => {
    return Array.from(markedForReview).sort((a, b) => a - b);
  };

  // Navigate to next/previous flagged question
  const navigateToNextFlagged = () => {
    const flagged = getFlaggedQuestions();
    const currentIndexInFlagged = flagged.indexOf(currentIndex);
    if (currentIndexInFlagged < flagged.length - 1) {
      setCurrentIndex(flagged[currentIndexInFlagged + 1]);
    }
  };

  const navigateToPreviousFlagged = () => {
    const flagged = getFlaggedQuestions();
    const currentIndexInFlagged = flagged.indexOf(currentIndex);
    if (currentIndexInFlagged > 0) {
      setCurrentIndex(flagged[currentIndexInFlagged - 1]);
    }
  };

  // Function to terminate quiz for violations
  const terminateQuiz = async (reason: string) => {
    setQuizTerminated(true);
    setTerminationReason(reason);
    
    // Auto-submit quiz with cheating flag if attempt exists
    if (attemptId) {
      try {
        console.log(`Quiz terminated: ${reason}`);
        
        // Calculate current score based on answered questions
        let totalMarksObtained = 0;
        const totalPossibleMarks = questions.reduce((sum, q) => sum + q.marks, 0);
        
        // Grade all answered questions
        for (const question of questions) {
          const studentAnswer = answers[question.id];
          if (studentAnswer) {
            let isCorrect = false;
            
            if (question.question_type === 'mcq' || question.question_type === 'true_false') {
              isCorrect = studentAnswer === question.correct_answer;
            } else if (question.question_type === 'short_answer') {
              // For short answers, you might need manual grading or basic string matching
              isCorrect = studentAnswer.toLowerCase().trim() === question.correct_answer?.toLowerCase().trim();
            }
            
            if (isCorrect) {
              totalMarksObtained += question.marks;
            }
            
            // Save student answer
            await db.createStudentAnswer({
              attempt_id: attemptId,
              question_id: question.id,
              answer_text: studentAnswer,
              is_correct: isCorrect,
              marks_obtained: isCorrect ? question.marks : 0
            });
          }
        }
        
        const scorePercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
        
        // Update quiz attempt with cheating flag and score
        const updateData = {
          status: 'graded' as const,
          score: Math.round(scorePercentage),
          submitted_at: new Date().toISOString(),
          graded_at: new Date().toISOString(),
          // Add cheating metadata (you'd need to add these columns to database)
          cheated: true,
          cheating_reason: reason,
          tab_switch_count: tabSwitchCount,
          copy_attempts: copyAttempts,
          right_click_count: rightClickCount
        };
        
        const updateResult = await db.updateQuizAttempt(attemptId, updateData);
        console.log('Quiz auto-submitted with cheating flag:', updateResult);
        
      } catch (error) {
        console.error('Error auto-submitting terminated quiz:', error);
      }
    }
    
    // Redirect after showing termination message
    setTimeout(() => {
      navigate('/student/attempts');
    }, 5000);
  };

  useEffect(() => {
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
  }, [timeLeft]);

  // Anti-cheating measures
  useEffect(() => {
    const handleVisibilityChange = () => {
      setWindowFocus(!document.hidden);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      alert('Right-click is disabled during the quiz to prevent copying content.');
      setRightClickCount(prev => prev + 1);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect common cheating keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            if (e.shiftKey) {
              e.preventDefault();
              setCopyAttempts(prev => prev + 1);
              if (copyAttempts >= 3) {
                terminateQuiz('Excessive copy attempts detected. Quiz terminated for academic integrity violation.');
              } else {
                alert(`Warning: Copy attempt detected (${copyAttempts + 1}/4). Multiple copy attempts will result in quiz termination.`);
              }
            }
            break;
          case 'a':
            if (e.shiftKey) {
              e.preventDefault();
              alert('Select All is disabled during the quiz.');
            }
            break;
          case 'f':
            if (e.shiftKey) {
              e.preventDefault();
              alert('Find is disabled during the quiz.');
            }
            break;
          case 'p':
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              alert('Print is disabled during the quiz.');
            }
            break;
        }
      }
    };

    const handleTabSwitch = () => {
      setTabSwitchCount(prev => prev + 1);
      if (tabSwitchCount >= 3) {
        terminateQuiz('Excessive tab switching detected. Quiz terminated for academic integrity violation.');
      } else {
        alert(`Warning: Tab switching detected (${tabSwitchCount + 1}/4). Multiple tab switches will result in quiz termination.`);
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleTabSwitch);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleTabSwitch);
    };
  }, [copyAttempts, tabSwitchCount]);

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
    console.log('Existing attempts for quiz', id, 'user', user.id, ':', existingAttempts);
    
    const inProgressAttempt = existingAttempts.find(a => a.status === 'in_progress');
    const completedAttempt = existingAttempts.find(a => a.status === 'submitted' || a.status === 'graded');

    console.log('In progress attempt:', inProgressAttempt);
    console.log('Completed attempt:', completedAttempt);

    // Only block if there's a legitimate completed attempt (not from cheating violations or system errors)
    if (completedAttempt) {
      // Check if this is a valid completed attempt
      const hasValidSubmission = completedAttempt.submitted_at && 
                                !completedAttempt.cheated && 
                                completedAttempt.status !== 'expired';
      
      console.log('Completed attempt details:', {
        submitted_at: completedAttempt.submitted_at,
        cheated: completedAttempt.cheated,
        status: completedAttempt.status,
        hasValidSubmission
      });

      if (hasValidSubmission) {
        // Student has already submitted this quiz legitimately - show results
        console.log('Showing quiz results for completed attempt:', completedAttempt);
        setCompletedAttemptData(completedAttempt);
        setShowResults(true);
        return;
      } else {
        // This appears to be an invalid or corrupted attempt, let's clean it up
        console.log('Cleaning up invalid completed attempt:', completedAttempt.id);
        await db.updateQuizAttempt(completedAttempt.id, { 
          status: 'expired',
          submitted_at: null,
          graded_at: null
        });
      }
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

  if (!quiz || !Array.isArray(questions) || questions.length === 0) {
    return <div>Loading...</div>;
  }

  // Show results screen if quiz has been completed
  if (showResults && completedAttemptData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="text-center space-y-6">
            <div className="text-green-600 text-6xl">✅</div>
            <h1 className="text-3xl font-bold text-gray-900">Quiz Completed</h1>
            <div className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">{quiz.title}</h2>
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-medium capitalize">{completedAttemptData.status}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Score</p>
                  <p className="font-medium text-2xl text-blue-600">
                    {completedAttemptData.score !== null ? `${completedAttemptData.score}%` : 'Pending'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="font-medium">
                    {completedAttemptData.submitted_at 
                      ? new Date(completedAttemptData.submitted_at).toLocaleString()
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Time Taken</p>
                  <p className="font-medium">
                    {completedAttemptData.started_at && completedAttemptData.submitted_at
                      ? Math.round((new Date(completedAttemptData.submitted_at).getTime() - new Date(completedAttemptData.started_at).getTime()) / 60000)
                      : 'N/A'
                    } minutes
                  </p>
                </div>
              </div>
            </div>
            
            {completedAttemptData.cheated && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium">⚠️ Academic Integrity Violation</p>
                <p className="text-red-700 text-sm mt-1">{completedAttemptData.cheating_reason}</p>
              </div>
            )}
            
            <div className="flex justify-center gap-4">
              <Button variant="secondary" onClick={() => navigate('/student/quizzes')}>
                Back to Quizzes
              </Button>
              <Button onClick={() => navigate('/student/attempts')}>
                View All Attempts
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Show termination screen if quiz was terminated
  if (quizTerminated) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card className="border-red-200 bg-red-50">
          <div className="text-center space-y-4">
            <div className="text-red-600 text-6xl">⚠️</div>
            <h1 className="text-2xl font-bold text-red-800">Quiz Terminated Due to Violations</h1>
            <p className="text-red-700">
              {terminationReason}
            </p>
            <div className="bg-red-100 border border-red-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-red-800 mb-2">What happened:</h3>
              <p className="text-red-700 text-sm">
                Your quiz has been automatically terminated due to multiple academic integrity violations.
                Your quiz is being auto-submitted with your current answers and flagged for instructor review.
              </p>
            </div>
            <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-yellow-800 mb-2">Quiz Status:</h3>
              <ul className="text-yellow-700 text-sm space-y-1">
                <li>✅ Quiz automatically submitted</li>
                <li>✅ Current answers saved</li>
                <li>✅ Score calculated based on answered questions</li>
                <li>⚠️ Flagged as cheating violation</li>
                <li>📝 Incident logged for instructor review</li>
              </ul>
            </div>
            <div className="bg-gray-100 border border-gray-200 rounded-lg p-4 text-left">
              <h3 className="font-semibold text-gray-800 mb-2">Violation Details:</h3>
              <ul className="text-gray-700 text-sm space-y-1">
                <li>Tab switches: {tabSwitchCount}</li>
                <li>Copy attempts: {copyAttempts}</li>
                <li>Right clicks: {rightClickCount}</li>
                <li>Reason: {terminationReason}</li>
              </ul>
            </div>
            <p className="text-gray-600 text-sm">
              You will be redirected to your attempts page in 5 seconds...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Only show quiz interface if not terminated */}
      {!quizTerminated && quiz.deadline && (
        <Card className="bg-orange-50 border-orange-200">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertCircle size={20} />
            <span className="font-medium">
              Deadline: {new Date(quiz.deadline).toLocaleString()}
            </span>
          </div>
        </Card>
      )}

      {/* Only show quiz interface if not terminated */}
      {!quizTerminated && (
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
                  const options = parseOptions(currentQuestion.options);

                  return options.map((option, index) => (
                    <label key={index} className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option}
                        checked={answers[currentQuestion.id] === option}
                        onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ));
                })()}
              </div>
            )}

            {currentQuestion.question_type === 'true_false' && (
              <div className="space-y-3">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value="true"
                    checked={answers[currentQuestion.id] === 'true'}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">True</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value="false"
                    checked={answers[currentQuestion.id] === 'false'}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">False</span>
                </label>
              </div>
            )}

            {currentQuestion.question_type === 'short_answer' && (
              <Textarea
                value={answers[currentQuestion.id] || ''}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Enter your answer here..."
                rows={4}
              />
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
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
                />
                <label htmlFor="mark-review" className="text-sm text-gray-700">
                  Mark for review
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
                  className={`text-xs ${
                    showFlaggedOnly 
                      ? 'bg-orange-500 text-white hover:bg-orange-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Flag size={14} className="mr-1" />
                  {showFlaggedOnly ? 'Show All' : 'Flagged Only'}
                </Button>
                <span className="text-xs text-gray-500">
                  {markedForReview.size} flagged
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Only show navigation if not terminated */}
      {!quizTerminated && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => showFlaggedOnly ? navigateToPreviousFlagged() : setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={showFlaggedOnly ? getFlaggedQuestions().indexOf(currentIndex) <= 0 : currentIndex === 0}
          >
            <ChevronLeft size={18} className="mr-1" />
            {showFlaggedOnly ? 'Previous Flagged' : 'Previous'}
          </Button>

          <div className="flex gap-2">
            {(showFlaggedOnly ? getFlaggedQuestions() : questions.map((_, index) => index)).map((index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                  index === currentIndex
                    ? 'bg-blue-600 text-white'
                    : markedForReview.has(index)
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {showFlaggedOnly ? (
            getFlaggedQuestions().indexOf(currentIndex) === getFlaggedQuestions().length - 1 ? (
              <Button onClick={() => setShowSubmitModal(true)}>
                Submit Quiz
              </Button>
            ) : (
              <Button onClick={() => navigateToNextFlagged()}>
                Next Flagged
                <ChevronRight size={18} className="ml-1" />
              </Button>
            )
          ) : currentIndex === questions.length - 1 ? (
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
      )}

      {/* Only show submit modal if not terminated */}
      {!quizTerminated && (
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
      )}
    </div>
  );
}
