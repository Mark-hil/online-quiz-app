import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, CheckCircle, XCircle, ShieldAlert, ShieldCheck, 
  Eye, Smartphone, Laptop, AlertTriangle, 
  Copy, MousePointer, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { db, QuizAttempt, StudentAnswer, Question, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { getOptimizedCloudinaryUrl } from '../../lib/cloudinary';

interface SubmissionDetail {
  attempt: QuizAttempt & { student_name: string; quiz_title: string; total_possible_marks: number };
  answers: (StudentAnswer & { question: Question })[];
  quiz: Quiz;
}

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<SubmissionDetail | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: { marks: number; comment: string; correctAnswer: string } }>({});
  const [loading, setLoading] = useState(false);
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  const [updatingIntegrity, setUpdatingIntegrity] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState<{ url: string; title: string; time?: string } | null>(null);
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
      
      // Get questions for the quiz once
      const questions = await db.getQuestions(attemptData.quiz_id);
      
      const totalPossibleMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
      
      // Get questions for each answer
      const formattedAnswers = answersData.map((answer: any) => {
        const question = questions.find(q => q.id === answer.question_id);
        return {
          ...answer,
          question,
        };
      });

      const formatted: SubmissionDetail = {
        attempt: {
          ...attemptData,
          student_name: studentProfile?.name || 'Unknown',
          quiz_title: quiz?.title || 'Unknown',
          total_possible_marks: totalPossibleMarks,
        } as QuizAttempt & { student_name: string; quiz_title: string; total_possible_marks: number },
        answers: formattedAnswers,
        quiz: quiz as Quiz,
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
      const totalPossibleMarks = data.attempt.total_possible_marks;

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

  const handleToggleCheating = async () => {
    if (!data) return;
    const isCurrentlyCheating = data.attempt.cheated;
    const actionPrompt = isCurrentlyCheating 
      ? 'Clear this academic integrity violation flag?' 
      : 'Flag this attempt as an academic integrity / cheating violation?';

    if (!confirm(actionPrompt)) return;

    let reason = data.attempt.cheating_reason || '';
    if (!isCurrentlyCheating) {
      const enteredReason = prompt('Enter a reason for flagging this submission (e.g. Unexplained tab switches during lab):', 'Flagged after lecturer review');
      if (enteredReason === null) return;
      reason = enteredReason.trim() || 'Flagged after lecturer review';
    }

    setUpdatingIntegrity(true);
    try {
      await db.updateQuizAttempt(data.attempt.id, {
        cheated: !isCurrentlyCheating,
        cheating_reason: !isCurrentlyCheating ? reason : null,
      });

      setData({
        ...data,
        attempt: {
          ...data.attempt,
          cheated: !isCurrentlyCheating,
          cheating_reason: !isCurrentlyCheating ? reason : undefined,
        }
      });
      alert(!isCurrentlyCheating ? 'Submission marked as cheating violation.' : 'Integrity flag cleared successfully.');
    } catch (err) {
      console.error('Failed to update integrity flag:', err);
      alert('Failed to update integrity flag.');
    } finally {
      setUpdatingIntegrity(false);
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

      {/* Attempt Summary & Time Taken */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Score</span>
            <span className="text-xl font-bold text-blue-600">
              {data.attempt.score !== null ? `${Number(data.attempt.score).toFixed(2)}%` : 'Pending'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Status</span>
            <Badge variant={data.attempt.status === 'graded' ? 'success' : 'warning'}>
              {data.attempt.status}
            </Badge>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Submitted</span>
            <span className="text-gray-800 font-medium">
              {data.attempt.submitted_at
                ? new Date(data.attempt.submitted_at).toLocaleString()
                : 'In Progress'}
            </span>
          </div>
          <div>
            <span className="text-gray-500 block text-xs uppercase tracking-wider mb-1">Time Taken</span>
            <span className="text-gray-800 font-medium">
              {data.attempt.started_at && data.attempt.submitted_at
                ? `${Math.round((new Date(data.attempt.submitted_at).getTime() - new Date(data.attempt.started_at).getTime()) / 60000)} mins`
                : 'N/A'}
            </span>
          </div>
        </div>
      </Card>

      {/* Academic Integrity & Proctoring Audit Card */}
      {(() => {
        const attempt = data.attempt;
        const quiz = data.quiz;
        const isCheated = attempt.cheated;
        const hasActivity = (attempt.tab_switch_count || 0) > 0 || (attempt.copy_attempts || 0) > 0 || (attempt.right_click_count || 0) > 0;
        const userAgentStr = attempt.user_agent || '';
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgentStr);

        let parsedLogs: any[] = [];
        if (attempt.suspicious_activity) {
          try {
            parsedLogs = typeof attempt.suspicious_activity === 'string' 
              ? JSON.parse(attempt.suspicious_activity) 
              : attempt.suspicious_activity;
          } catch (e) {
            console.error('Failed to parse suspicious activity logs', e);
          }
        }

        return (
          <Card className={`border-2 ${
            isCheated 
              ? 'border-red-300 bg-red-50/40' 
              : hasActivity 
              ? 'border-amber-300 bg-amber-50/30' 
              : 'border-emerald-300 bg-emerald-50/20'
          }`}>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  {isCheated ? (
                    <ShieldAlert size={22} className="text-red-600" />
                  ) : hasActivity ? (
                    <AlertTriangle size={22} className="text-amber-600" />
                  ) : (
                    <ShieldCheck size={22} className="text-emerald-600" />
                  )}
                  <div>
                    <h2 className="text-base font-bold text-gray-900">
                      Academic Integrity & Proctoring Audit
                    </h2>
                    <p className="text-xs text-gray-500">
                      Real-time device and security telemetry logged during this assessment
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={isCheated ? 'danger' : hasActivity ? 'warning' : 'success'}>
                    {isCheated ? '⚠️ Violation Flagged' : hasActivity ? '⚠️ Activity Detected' : '✅ Clean Record'}
                  </Badge>
                  <Button
                    size="sm"
                    variant={isCheated ? 'secondary' : 'danger'}
                    onClick={handleToggleCheating}
                    disabled={updatingIntegrity}
                    className="text-xs"
                  >
                    {isCheated ? 'Clear Flag' : 'Flag Cheating'}
                  </Button>
                </div>
              </div>

              {/* Cheating Reason Alert if Flagged */}
              {isCheated && attempt.cheating_reason && (
                <div className="bg-red-100/80 border border-red-300 rounded-lg p-3 text-sm text-red-900">
                  <span className="font-semibold">Reason Flagged: </span>
                  {attempt.cheating_reason}
                </div>
              )}

              {/* Proctoring Policy vs Detected Activity Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
                    {isMobile ? <Smartphone size={15} className="text-blue-500" /> : <Laptop size={15} className="text-blue-500" />}
                    Device Type
                  </div>
                  <div className="mt-1 text-sm font-bold text-gray-800">
                    {userAgentStr ? (isMobile ? 'Mobile Phone / Tablet' : 'Desktop / Laptop') : 'Unknown Device'}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5" title={userAgentStr}>
                    {userAgentStr ? userAgentStr.slice(0, 45) + '...' : 'Browser UA not captured'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <Eye size={15} className="text-indigo-500" />
                    Tab Switches
                  </div>
                  <div className={`mt-1 text-sm font-bold ${
                    (attempt.tab_switch_count || 0) > 2 ? 'text-red-600' : (attempt.tab_switch_count || 0) > 0 ? 'text-amber-600' : 'text-gray-800'
                  }`}>
                    {attempt.tab_switch_count || 0} event{(attempt.tab_switch_count || 0) === 1 ? '' : 's'}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {quiz?.enable_tab_monitoring === false ? 'Monitoring was disabled' : 'Window defocus detected'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <Copy size={15} className="text-orange-500" />
                    Copy Attempts
                  </div>
                  <div className={`mt-1 text-sm font-bold ${
                    (attempt.copy_attempts || 0) > 0 ? 'text-red-600' : 'text-gray-800'
                  }`}>
                    {attempt.copy_attempts || 0} attempt{(attempt.copy_attempts || 0) === 1 ? '' : 's'}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {quiz?.enable_copy_paste_prevention === false ? 'Copying allowed' : 'Keyboard copy blocked'}
                  </p>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <MousePointer size={15} className="text-green-500" />
                    Right Clicks
                  </div>
                  <div className={`mt-1 text-sm font-bold ${
                    (attempt.right_click_count || 0) > 0 ? 'text-amber-600' : 'text-gray-800'
                  }`}>
                    {attempt.right_click_count || 0} attempt{(attempt.right_click_count || 0) === 1 ? '' : 's'}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Context menu interactions
                  </p>
                </div>
              </div>

              {/* Quiz Security Configuration Badges */}
              <div className="pt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-gray-600">Quiz Security Enforced:</span>
                <span className={`px-2 py-0.5 rounded-full border ${
                  quiz?.require_seb 
                    ? 'bg-amber-100 text-amber-800 border-amber-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  🔒 SEB: {quiz?.require_seb ? 'Required' : 'Disabled (Browser & Mobile Allowed)'}
                </span>

                <span className={`px-2 py-0.5 rounded-full border ${
                  quiz?.enable_camera_proctoring 
                    ? 'bg-blue-100 text-blue-800 border-blue-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  📹 Camera: {quiz?.enable_camera_proctoring ? 'Enforced' : 'Off'}
                </span>

                <span className={`px-2 py-0.5 rounded-full border ${
                  quiz?.enable_screen_recording 
                    ? 'bg-purple-100 text-purple-800 border-purple-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  🖥️ Screen Share: {quiz?.enable_screen_recording ? 'Enforced' : 'Off'}
                </span>

                <span className={`px-2 py-0.5 rounded-full border ${
                  quiz?.enable_tab_monitoring !== false
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  👁️ Tab Monitoring: {quiz?.enable_tab_monitoring !== false ? 'Active' : 'Off'}
                </span>
              </div>

              {/* Expandable Activity Logs Timeline */}
              {parsedLogs && parsedLogs.length > 0 && (
                <div className="pt-2 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowActivityLogs(!showActivityLogs)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <span>{showActivityLogs ? 'Hide' : 'View'} Incident Event Log ({parsedLogs.length} events)</span>
                    {showActivityLogs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showActivityLogs && (
                    <div className="mt-3 bg-white rounded-lg border border-gray-200 p-3 max-h-56 overflow-y-auto space-y-2">
                      {parsedLogs.map((log: any, idx: number) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                          <div className="flex items-start gap-2">
                            <span className="text-gray-400 font-mono shrink-0">
                              {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                            </span>
                            <span className="font-semibold text-gray-700 capitalize shrink-0">
                              [{log.type?.replace(/_/g, ' ') || 'event'}]:
                            </span>
                            <span className="text-gray-600">{log.details}</span>
                          </div>
                          {log.snapshot && (
                            <button
                              type="button"
                              onClick={() => setPreviewSnapshot({
                                url: log.snapshot,
                                title: `Proctoring Incident Snapshot - [${log.type}]`,
                                time: log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : undefined,
                              })}
                              className="shrink-0 flex items-center gap-1.5 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded p-1 self-start sm:self-auto cursor-pointer transition-colors group"
                              title="Click to view full snapshot"
                            >
                              <img
                                src={getOptimizedCloudinaryUrl(log.snapshot, { width: 160, height: 120 })}
                                alt="Incident webcam snapshot"
                                className="w-16 h-12 rounded object-cover border border-gray-300 shadow-sm group-hover:border-blue-400"
                              />
                              <span className="text-[10px] text-gray-500 font-medium group-hover:text-blue-600">Cam Snapshot</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })()}

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

      {/* High-Resolution Incident Snapshot Lightbox Modal */}
      {previewSnapshot && (
        <Modal
          isOpen={true}
          onClose={() => setPreviewSnapshot(null)}
          title={previewSnapshot.title}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b">
              <span>Candidate: <strong className="text-gray-900">{data?.attempt.student_name}</strong></span>
              {previewSnapshot.time && <span>Incident Time: <strong className="font-mono text-gray-900">{previewSnapshot.time}</strong></span>}
            </div>

            <div className="relative bg-gray-950 rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center border border-gray-800 shadow-inner">
              <img
                src={previewSnapshot.url}
                alt={previewSnapshot.title}
                className="max-h-[65vh] w-auto max-w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {previewSnapshot.url.startsWith('http') ? (
                <a
                  href={previewSnapshot.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={13} /> View Full-Resolution on Cloudinary CDN
                </a>
              ) : (
                <span className="text-xs text-gray-400">Database snapshot</span>
              )}
              <Button size="sm" onClick={() => setPreviewSnapshot(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
