import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Award } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { db, QuizAttempt, StudentAnswer, Question } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

interface ResultDetail {
  attempt: QuizAttempt & { quiz_title: string; quiz_marks: number; show_results_immediately?: boolean };
  answers: (StudentAnswer & { question: Question })[];
}

export default function Results() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ResultDetail | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    loadResult();
  }, [id]);

  const loadResult = async () => {
    if (!id || !user) return;

    // Get attempt - filter by user ID for security
    const attempts = await db.getQuizAttempts(undefined, user.id);
    const attemptData = attempts.find(a => a.id === id);

    if (attemptData) {
      // Get quiz info
      const quizzes = await db.getQuizzes();
      const quiz = quizzes.find(q => q.id === attemptData.quiz_id);

      // Get answers with questions
      const answersData = await db.getStudentAnswers(id);
      
      // Get all questions once to prevent redundant DB calls
      const allQuestions = await db.getQuestions();
      
      // Get questions for each answer
      const formattedAnswers = answersData.map((answer: any) => {
        const question = allQuestions.find(q => q.id === answer.question_id);
        return {
          ...answer,
          question,
        };
      });

      // Use the score from the attempt, it should already be calculated when submitted
      let score = attemptData.score;

      // recalc if score is missing, NaN, or we just want to ensure correctness
      if ((score === null || score === undefined || isNaN(score)) && formattedAnswers.length > 0) {
        const totalMarks = formattedAnswers.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
        const maxMarks = quiz?.total_marks || 100;
        score = maxMarks > 0 ? (totalMarks / maxMarks) * 100 : 0;
        
        // update the attempt if the value was incorrect or missing
        await db.updateQuizAttempt(id, { score });
      }
      
      if (score === null || score === undefined || isNaN(score)) {
        score = 0;
      }

      const formatted: ResultDetail = {
        attempt: {
          ...attemptData,
          quiz_title: quiz?.title || 'Unknown',
          quiz_marks: quiz?.total_marks || 0,
          score: score,
          show_results_immediately: quiz?.show_results_immediately !== false,
        } as QuizAttempt & { quiz_title: string; quiz_marks: number; show_results_immediately?: boolean },
        answers: formattedAnswers,
      };

      setData(formatted);
    }
  };

  if (!data) return <div>Loading...</div>;

  if (data.attempt.show_results_immediately === false) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 mt-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Results Hidden</h1>
        <p className="text-gray-600 mb-6">The lecturer has chosen to hide the results for this quiz.</p>
        <Button onClick={() => navigate('/student/attempts')}>Back to Attempts</Button>
      </div>
    );
  }

  const totalMarks = data.answers.reduce((sum, a) => sum + (a.marks_obtained || 0), 0);
  const totalPossible = data.answers.reduce((sum, a) => sum + a.question.marks, 0);
  let percentage: number;
  if (data.attempt.score !== null && data.attempt.score !== undefined) {
    const parsed = parseFloat(String(data.attempt.score));
    percentage = isNaN(parsed) ? (totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0) : parsed;
  } else {
    percentage = totalPossible > 0 ? (totalMarks / totalPossible) * 100 : 0;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button
          variant="secondary"
          onClick={() => navigate('/student/attempts')}
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{data.attempt.quiz_title}</h1>
          <p className="text-gray-600">Quiz Results</p>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Your Score</p>
            <p className="text-4xl font-bold text-gray-900">
              {percentage.toFixed(2)}%
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {totalMarks} out of {totalPossible} marks
            </p>
          </div>
          <div className="p-4 bg-blue-100 rounded-lg">
            <Award className="text-blue-600" size={48} />
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {data.answers.map((answer, index) => {
          const isCorrect = answer.is_correct;

          return (
            <Card key={answer.id}>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold">Question {index + 1}</span>
                      <Badge variant="secondary">{answer.question.question_type}</Badge>
                      <Badge variant="primary">
                        {answer.marks_obtained || 0} / {answer.question.marks} marks
                      </Badge>
                    </div>
                    <p className="text-gray-900">{answer.question.question_text}</p>
                  </div>
                  {answer.question.question_type !== 'essay' && (
                    <div>
                      {isCorrect ? (
                        <CheckCircle className="text-green-500" size={24} />
                      ) : (
                        <XCircle className="text-red-500" size={24} />
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2 font-medium">Your Answer:</p>
                  <p className="text-gray-900">{answer.answer_text || 'No answer provided'}</p>
                </div>

                {answer.question.question_type !== 'essay' && (
                  <div className={`p-4 rounded-md border ${
                    isCorrect
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <p className="text-sm text-gray-600 mb-2 font-medium">Correct Answer:</p>
                    <p className={isCorrect ? 'text-green-900 font-medium' : 'text-red-900 font-medium'}>
                      {answer.question.correct_answer}
                    </p>
                  </div>
                )}

                {answer.lecturer_comment && (
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600 mb-1">Lecturer Comment:</p>
                    <p className="text-blue-900">{answer.lecturer_comment}</p>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
