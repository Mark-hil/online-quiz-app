import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Badge from '../../components/ui/Badge';
import { db, QuizAttempt, StudentAnswer, Question } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface SubmissionDetail {
  attempt: QuizAttempt & { student_name: string; quiz_title: string };
  answers: (StudentAnswer & { question: Question })[];
}

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: { marks: number; comment: string; correctAnswer: string } }>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadSubmission();
  }, [id]);

  const loadSubmission = async () => {
    if (!id) return;

    // Security check: verify this lecturer owns the quiz before proceeding
    if (!user) {
      alert('You must be logged in to view submissions.');
      navigate('/lecturer/submissions');
      return;
    }
    
    const lecturerQuizzes = await db.getQuizzes(user.id);
    
    // Get the attempt by first finding which quiz it belongs to
    // We need to search through the lecturer's quizzes to find the attempt
    let attemptData = null;
    let foundQuiz = null;
    
    for (const quiz of lecturerQuizzes) {
      const attempts = await db.getQuizAttempts(quiz.id);
      const found = attempts.find(a => a.id === id);
      if (found) {
        attemptData = found;
        foundQuiz = quiz;
        break;
      }
    }
    
    if (!attemptData) {
      alert('Submission not found or you do not have permission to view it.');
      navigate('/lecturer/submissions');
      return;
    }

    if (attemptData && user) {
      // Get student profile
      const studentProfile = await db.getProfile(attemptData.student_id);
      
      // Use the quiz we already found
      const quiz = foundQuiz;
      
      // Security check: ensure this lecturer owns the quiz
      if (!quiz) {
        alert('You do not have permission to view this submission.');
        navigate('/lecturer/submissions');
        return;
      }

      // Get answers with questions
      const answersData = await db.getStudentAnswers(id);
      
      // Get questions for each answer
      const formattedAnswers = await Promise.all(
        answersData.map(async (answer: any) => {
          // Get questions for each answer (only for this quiz)
          const questions = await db.getQuestions(attemptData.quiz_id);
          const question = questions.find(q => q.id === answer.question_id);
          return {
            ...answer,
            question,
          };
        })
      );

      const formatted: SubmissionDetail = {
        attempt: {
          ...attemptData,
          student_name: studentProfile?.name || 'Unknown',
          quiz_title: quiz?.title || 'Unknown',
        } as QuizAttempt & { student_name: string; quiz_title: string },
        answers: formattedAnswers,
      };

      setData(formatted);

      const initialAnswers: any = {};
      answersData?.forEach((a: any) => {
        initialAnswers[a.id] = {
          marks: a.marks_obtained || 0,
          comment: a.lecturer_comment || '',
          correctAnswer: '',
        };
      });
      setAnswers(initialAnswers);
    }
  };

  const handleSaveGrade = async () => {
    if (!data) return;

    setLoading(true);

    try {
      let totalMarks = 0;
      const totalPossibleMarks = data.answers.reduce((sum, a) => sum + a.question.marks, 0);

      for (const answer of data.answers) {
        const { marks, comment, correctAnswer } = answers[answer.id] || {};
        let finalMarks = marks || 0;
        let isCorrect = null;

        if (answer.question.question_type !== 'essay' && !answer.is_correct) {
          isCorrect = answer.answer_text === answer.question.correct_answer;
          if (isCorrect) {
            finalMarks = answer.question.marks;
          } else {
            finalMarks = 0;
          }
        } else if (answer.question.question_type === 'essay') {
          if (correctAnswer) {
            isCorrect = answer.answer_text === correctAnswer;
            if (isCorrect) {
              finalMarks = answer.question.marks;
            }
          }
        }

        await db.updateStudentAnswer(answer.id, {
          marks_obtained: finalMarks,
          lecturer_comment: comment,
          is_correct: isCorrect,
        });

        totalMarks += finalMarks;
      }

      // Calculate percentage based on total marks
      const percentage = totalPossibleMarks > 0 ? (totalMarks / totalPossibleMarks) * 100 : 0;

      // Update attempt with both score and status
      await db.updateQuizAttempt(data.attempt.id, {
        score: percentage,
        status: 'graded',
        graded_at: new Date().toISOString(),
      });

      alert('Grades saved successfully');
      navigate('/lecturer/submissions');
    } catch (error) {
      console.error('Error saving grades:', error);
      alert('Failed to save grades');
    } finally {
      setLoading(false);
    }
  };

  if (!data) return <div>Loading...</div>;

  // determine if this submission has any essay questions that require manual grading
  const isAutoGraded = data.answers.every(a => a.question.question_type !== 'essay');

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          onClick={() => navigate('/lecturer/submissions')}
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.attempt.quiz_title}</h1>
          <p className="text-gray-600">Student: {data.attempt.student_name}</p>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Submitted:</span>{' '}
            {data.attempt.submitted_at
              ? new Date(data.attempt.submitted_at).toLocaleString()
              : 'In Progress'}
          </div>
          <div>
            <span className="text-gray-600">Status:</span>{' '}
            <Badge variant={data.attempt.status === 'graded' ? 'success' : 'warning'}>
              {data.attempt.status}
            </Badge>
          </div>
        </div>
      </Card>

      {data.answers.map((answer, index) => {
        const isCorrect = answer.question.question_type !== 'essay' &&
          answer.answer_text === answer.question.correct_answer;

        return (
          <Card key={answer.id}>
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold">Question {index + 1}</span>
                    <Badge variant="secondary">{answer.question.question_type}</Badge>
                    <Badge variant="primary">{answer.question.marks} marks</Badge>
                  </div>
                  <p className="text-gray-900">{answer.question.question_text}</p>
                </div>
                {answer.question.question_type === 'mcq' && (
                  <div>
                    {isCorrect ? (
                      <CheckCircle className="text-green-500" size={24} />
                    ) : (
                      <XCircle className="text-red-500" size={24} />
                    )}
                  </div>
                )}
                {answer.question.question_type === 'true_false' && (
                  <div>
                    {isCorrect ? (
                      <CheckCircle className="text-green-500" size={24} />
                    ) : (
                      <XCircle className="text-red-500" size={24} />
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm text-gray-600 mb-1">Student's Answer:</p>
                <p className="text-gray-900">{answer.answer_text || 'No answer provided'}</p>
              </div>

              {answer.question.question_type === 'mcq' && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600 mb-1">Correct Answer (from question):</p>
                  <p className="text-blue-900 font-medium">{answer.question.correct_answer}</p>
                  {!isCorrect && (
                    <p className="text-sm text-red-600 mt-2">Mark as Incorrect</p>
                  )}
                </div>
              )}

              {answer.question.question_type === 'true_false' && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <p className="text-sm text-gray-600 mb-1">Correct Answer (from question):</p>
                  <p className="text-blue-900 font-medium capitalize">{answer.question.correct_answer}</p>
                  {!isCorrect && (
                    <p className="text-sm text-red-600 mt-2">Mark as Incorrect</p>
                  )}
                </div>
              )}

              {answer.question.question_type === 'essay' && (
                <Textarea
                  label="Expected/Model Answer (for auto-marking essay)"
                  value={answers[answer.id]?.correctAnswer || ''}
                  onChange={(e) =>
                    setAnswers({
                      ...answers,
                      [answer.id]: {
                        ...answers[answer.id],
                        correctAnswer: e.target.value,
                      },
                    })
                  }
                  rows={4}
                  placeholder="Enter the expected answer to auto-mark this essay question..."
                />
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Marks Obtained"
                  type="number"
                  value={answers[answer.id]?.marks || 0}
                  onChange={(e) =>
                    setAnswers({
                      ...answers,
                      [answer.id]: {
                        ...answers[answer.id],
                        marks: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  max={answer.question.marks}
                  min="0"
                  step="0.5"
                  readOnly={answer.question.question_type !== 'essay'}
                />
                <div className="flex items-end">
                  <span className="text-gray-600">out of {answer.question.marks}</span>
                  {answer.question.question_type !== 'essay' && (
                    <span className="text-xs text-gray-500 ml-2">(auto-calculated)</span>
                  )}
                </div>
              </div>

              {answer.question.question_type === 'essay' && (
                <Textarea
                  label="Lecturer Comment"
                  value={answers[answer.id]?.comment || ''}
                  onChange={(e) =>
                    setAnswers({
                      ...answers,
                      [answer.id]: {
                        ...answers[answer.id],
                        comment: e.target.value,
                      },
                    })
                  }
                  rows={3}
                  placeholder="Add feedback for the student..."
                />
              )}
            </div>
          </Card>
        );
      })}

      {/* only allow grading if there are essay questions */}
      {isAutoGraded ? (
        <div className="text-green-700 font-medium">
          This submission was automatically graded; no manual review is required.
        </div>
      ) : (
        <div className="flex justify-end">
          <Button onClick={handleSaveGrade} disabled={loading}>
            {loading ? 'Saving...' : 'Save Grades'}
          </Button>
        </div>
      )}
    </div>
  );
}
