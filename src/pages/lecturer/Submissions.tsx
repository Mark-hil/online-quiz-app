import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, FileText, Database, ChevronDown, AlertTriangle, CheckCircle } from 'lucide-react';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { db, QuizAttempt, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { pdfExporter, StudentResultPDF } from '../../utils/pdfExport';
import { csvExporter, StudentResult } from '../../utils/csvExport';

interface SubmissionRow extends QuizAttempt {
  student_name: string;
  index_number: string;
  quiz_title: string;
  cheated?: boolean;
  cheating_reason?: string;
  tab_switch_count?: number;
  copy_attempts?: number;
  right_click_count?: number;
}

export default function Submissions() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionRow[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [filterQuiz, setFilterQuiz] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [expiredAttempts, setExpiredAttempts] = useState<SubmissionRow[]>([]);
  const [forceGrading, setForceGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<{ graded: number; failed: number } | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportDropdown) {
        const target = event.target as Element;
        if (!target.closest('.export-dropdown')) {
          setShowExportDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportDropdown]);

  useEffect(() => {
    let filtered = submissions;

    if (filterQuiz !== 'all') {
      filtered = filtered.filter(s => s.quiz_id === filterQuiz);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    setFilteredSubmissions(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [filterQuiz, filterStatus, submissions]);

  const loadData = async () => {
    if (!user) return;

    // Fetch quizzes and all attempts concurrently — they are independent
    const [quizzesData, allAttempts] = await Promise.all([
      db.getQuizzes(user.id),
      db.getLecturerQuizAttempts(user.id),
    ]);
    setQuizzes(quizzesData as Quiz[]);

    // Get unique student IDs and fetch their profiles in batch
    const studentIds = [...new Set(allAttempts.map((a: any) => a.student_id))];
    const profiles = await db.getProfilesByIds(studentIds);
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

    // Format attempts
    const formatted = allAttempts.map((attempt: any) => {
      // Get student profile
      const studentProfile = profileMap.get(attempt.student_id);
      // Get quiz info
      const quiz = quizzesData.find(q => q.id === attempt.quiz_id);
      
      return {
        ...attempt,
        student_name: studentProfile?.name || 'Unknown',
        index_number: studentProfile?.index_number || 'N/A',
        quiz_title: quiz?.title || 'Unknown',
      };
    });

    // Remove in_progress attempts if a completed (submitted/graded) version exists for the same quiz+student
    const submissionMap = new Map<string, any>();
    for (const sub of formatted) {
      const key = `${sub.quiz_id}:${sub.student_id}`;
      const existing = submissionMap.get(key);
      
      if (!existing) {
        submissionMap.set(key, sub);
      } else {
        // Prefer submitted/graded over in_progress; prefer graded over submitted
        const subPriority = (s: any) => {
          if (s.status === 'graded') return 3;
          if (s.status === 'submitted') return 2;
          return 1;
        };
        
        if (subPriority(sub) > subPriority(existing)) {
          submissionMap.set(key, sub);
        }
      }
    }

    // Separate expired attempts (in_progress but past quiz duration)
    const expired: SubmissionRow[] = [];
    const active: SubmissionRow[] = [];

    for (const sub of Array.from(submissionMap.values())) {
      if (sub.status === 'in_progress') {
        const quiz = quizzesData.find((q: any) => q.id === sub.quiz_id);
        const durationMs = (quiz?.duration_minutes || 0) * 60 * 1000;
        const ageMs = Date.now() - new Date(sub.started_at).getTime();
        if (durationMs > 0 && ageMs > durationMs) {
          // Time is up for this attempt — show it as expired
          expired.push({ ...sub, status: 'expired' as any });
          continue;
        }
      }
      active.push(sub);
    }

    setExpiredAttempts(expired);
    setSubmissions([...active, ...expired]);
    setFilteredSubmissions([...active, ...expired]);
  };

  // Force-grade all expired/abandoned attempts
  const forceGradeExpired = async () => {
    if (expiredAttempts.length === 0) return;
    if (!confirm(`This will auto-grade ${expiredAttempts.length} expired attempt(s) based on whatever answers they submitted before time ran out. Continue?`)) return;

    setForceGrading(true);
    setGradeResult(null);
    let graded = 0;
    let failed = 0;

    for (const attempt of expiredAttempts) {
      try {
        const quiz = quizzes.find(q => q.id === attempt.quiz_id);
        const questions = await db.getQuestions(attempt.quiz_id);
        const studentAnswers = await db.getStudentAnswers(attempt.id);
        const answerMap = new Map(studentAnswers.map((a: any) => [a.question_id, a]));

        let totalMarks = 0;
        let marksObtained = 0;
        const updatePromises: (() => Promise<any>)[] = [];

        for (const question of questions) {
          totalMarks += question.marks;
          if (question.question_type === 'essay') continue;
          const sa = answerMap.get(question.id) as any;
          if (sa) {
            const isCorrect = sa.answer_text === question.correct_answer;
            const marks = isCorrect ? question.marks : 0;
            marksObtained += marks;
            updatePromises.push(() => db.updateStudentAnswer(sa.id, { is_correct: isCorrect, marks_obtained: marks }));
          }
        }

        // Run updates in parallel chunks
        const chunkSize = 10;
        for (let i = 0; i < updatePromises.length; i += chunkSize) {
          await Promise.all(updatePromises.slice(i, i + chunkSize).map(fn => fn()));
        }

        const scorePercentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
        const hasEssay = questions.some((q: any) => q.question_type === 'essay');

        await db.updateQuizAttempt(attempt.id, {
          status: hasEssay ? 'submitted' : 'graded',
          score: Number(scorePercentage.toFixed(2)),
          submitted_at: new Date(new Date(attempt.started_at).getTime() + (quiz?.duration_minutes || 0) * 60 * 1000).toISOString(),
          graded_at: hasEssay ? null : new Date().toISOString(),
        });
        graded++;
      } catch (err) {
        console.error('Failed to force-grade attempt', attempt.id, err);
        failed++;
      }
    }

    setGradeResult({ graded, failed });
    setForceGrading(false);
    await loadData(); // Refresh the table
  };

  // Force-submit a single in_progress attempt
  const forceSubmitAttempt = async (attempt: SubmissionRow) => {
    if (!confirm(`Force submit quiz for ${attempt.student_name}? This will grade whatever answers they have saved so far.`)) return;

    try {
      const quiz = quizzes.find(q => q.id === attempt.quiz_id);
      const questions = await db.getQuestions(attempt.quiz_id);
      const studentAnswers = await db.getStudentAnswers(attempt.id);
      const answerMap = new Map(studentAnswers.map((a: any) => [a.question_id, a]));

      let totalMarks = 0;
      let marksObtained = 0;
      const updatePromises: (() => Promise<any>)[] = [];

      for (const question of questions) {
        totalMarks += question.marks;
        if (question.question_type === 'essay') continue;
        const sa = answerMap.get(question.id) as any;
        if (sa) {
          const isCorrect = sa.answer_text === question.correct_answer;
          const marks = isCorrect ? question.marks : 0;
          marksObtained += marks;
          updatePromises.push(() => db.updateStudentAnswer(sa.id, { is_correct: isCorrect, marks_obtained: marks }));
        }
      }

      const chunkSize = 10;
      for (let i = 0; i < updatePromises.length; i += chunkSize) {
        await Promise.all(updatePromises.slice(i, i + chunkSize).map(fn => fn()));
      }

      const scorePercentage = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
      const hasEssay = questions.some((q: any) => q.question_type === 'essay');

      await db.updateQuizAttempt(attempt.id, {
        status: hasEssay ? 'submitted' : 'graded',
        score: Number(scorePercentage.toFixed(2)),
        submitted_at: new Date(new Date(attempt.started_at).getTime() + (quiz?.duration_minutes || 0) * 60 * 1000).toISOString(),
        graded_at: hasEssay ? null : new Date().toISOString(),
      });

      alert(`Done! ${attempt.student_name} scored ${Number(scorePercentage.toFixed(2))}%`);
      await loadData();
    } catch (err) {
      console.error('Force submit failed:', err);
      alert('Failed to force submit. Check console for details.');
    }
  };

  // Regrade all graded/submitted attempts for a quiz
  const regradeAllAttempts = async (quizId: string) => {
    if (!confirm('This will recalculate the scores for all submitted and graded attempts for this quiz based on the total possible marks of all questions. This cannot be undone. Continue?')) {
      return;
    }

    try {
      const questions = await db.getQuestions(quizId);
      const totalPossibleMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

      if (totalPossibleMarks === 0) {
        alert('This quiz has 0 total possible marks. Cannot regrade.');
        return;
      }

      const attemptsToRegrade = filteredSubmissions.filter(s => 
        s.quiz_id === quizId && (s.status === 'submitted' || s.status === 'graded')
      );

      let regradedCount = 0;

      for (const attempt of attemptsToRegrade) {
        const studentAnswers = await db.getStudentAnswers(attempt.id);
        const marksObtained = studentAnswers.reduce((sum: number, a: any) => sum + (a.marks_obtained || 0), 0);
        
        const newScore = Number(((marksObtained / totalPossibleMarks) * 100).toFixed(2));
        
        if (attempt.score !== newScore) {
          await db.updateQuizAttempt(attempt.id, {
            score: newScore
          });
          regradedCount++;
        }
      }

      alert(`Successfully recalulated scores for ${regradedCount} attempts.`);
      await loadData();
    } catch (err) {
      console.error('Failed to regrade attempts:', err);
      alert('Failed to regrade attempts. Check console for details.');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const results: StudentResult[] = filteredSubmissions.map(submission => {
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      
      // Score is stored as a percentage in the database
      const percentage = Number(submission.score ?? 0);
      const totalMarks = Number(quiz?.total_marks ?? 100);
      const rawScore = Number(((percentage / 100) * totalMarks).toFixed(2));

      // Calculate time taken
      let timeTaken = 'N/A';
      if (submission.started_at && submission.submitted_at) {
        const diffMins = (new Date(submission.submitted_at).getTime() - new Date(submission.started_at).getTime()) / 60000;
        timeTaken = `${diffMins.toFixed(2)} mins`;
      }

      return {
        studentName: submission.student_name || 'Unknown',
        indexNumber: submission.index_number || 'Unknown',
        quizTitle: submission.quiz_title || 'Unknown',
        subject: quiz?.subject || 'Unknown',
        score: rawScore,
        totalMarks: totalMarks,
        percentage: percentage,
        status: submission.status || 'Unknown',
        submittedAt: submission.submitted_at || '',
        gradedAt: submission.graded_at || undefined,
        timeTaken: timeTaken
      };
    });

    const selectedQuiz = quizzes.find(q => q.id === filterQuiz);
    csvExporter.exportStudentResults(results, selectedQuiz?.title);
  };

  // Export all submissions data to CSV
  const exportAllSubmissionsData = async () => {
    try {
      // Prepare comprehensive data for all submissions
      const allData = filteredSubmissions.map(submission => {
        const quiz = quizzes.find(q => q.id === submission.quiz_id);
        return {
          'Student Name': submission.student_name || 'Unknown',
          'Index Number': submission.index_number || 'Unknown',
          'Quiz Title': submission.quiz_title || 'Unknown',
          'Quiz Subject': quiz?.subject || 'Unknown',
          'Quiz Duration': `${quiz?.duration_minutes || 0} mins`, // Added "minutes" unit
          'Score (%)': typeof submission.score === 'number' ? Number(submission.score.toFixed(2)) : 0,
          'Status': submission.status || 'Unknown',
          'Started At': submission.started_at ? new Date(submission.started_at).toLocaleString() : 'Unknown',
          'Submitted At': submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not submitted',
          'Graded At': submission.graded_at ? new Date(submission.graded_at).toLocaleString() : 'Not graded',
          'Cheated': submission.cheated ? 'Yes' : 'No',
          'Cheating Reason': submission.cheating_reason || 'N/A',
          'Tab Switch Count': submission.tab_switch_count || 0,
          'Copy Attempts': submission.copy_attempts || 0,
          'Right Click Count': submission.right_click_count || 0,
          'Quiz ID': submission.quiz_id || 'Unknown',
          'Attempt ID': submission.id || 'Unknown'
        };
      });

      // Create CSV content
      const headers = Object.keys(allData[0] || {});
      const csvContent = [
        headers.join(','),
        ...allData.map(row => 
          headers.map(header => {
            const value = row[header as keyof typeof row];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `all_submissions_data_${timestamp}.csv`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`Exported ${allData.length} submissions to CSV`);
    } catch (error) {
      console.error('Error exporting all submissions data:', error);
      alert('Error exporting data. Please try again.');
    }
  };

  // Export comprehensive test report for a specific quiz
  const exportTestReport = async (quizId: string, format: 'pdf' | 'csv' | 'json') => {
    try {
      const quiz = quizzes.find(q => q.id === quizId);
      if (!quiz) {
        alert('Quiz not found');
        return;
      }

      // Get quiz questions
      const questions = await db.getQuestions(quizId);
      
      // Get all submissions for this quiz
      const quizSubmissions = filteredSubmissions.filter(s => s.quiz_id === quizId);
      
      // Get detailed answers for each submission
      const detailedSubmissions = await Promise.all(
        quizSubmissions.map(async (submission) => {
          const answers = await db.getStudentAnswers(submission.id);
          return {
            ...submission,
            answers,
            questionCount: questions.length,
            answeredQuestions: answers.filter(a => a.answer_text !== null && a.answer_text !== '').length
          };
        })
      );

      // Calculate statistics
      const statistics = {
        totalSubmissions: quizSubmissions.length,
        averageScore: quizSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / quizSubmissions.length || 0,
        highestScore: Math.max(...quizSubmissions.map(s => s.score || 0)),
        lowestScore: Math.min(...quizSubmissions.map(s => s.score || 0)),
        passRate: quizSubmissions.filter(s => (s.score || 0) >= 50).length / quizSubmissions.length * 100,
        averageTimeTaken: quizSubmissions.reduce((sum, s) => {
          if (s.started_at && s.submitted_at) {
            const start = new Date(s.started_at);
            const end = new Date(s.submitted_at);
            return sum + (end.getTime() - start.getTime());
          }
          return sum;
        }, 0) / quizSubmissions.length / 1000 / 60, // in minutes
        questionAnalysis: questions.map(question => {
          const questionAnswers = detailedSubmissions.map(s => 
            s.answers.find(a => a.question_id === question.id)
          );
          const correctAnswers = questionAnswers.filter(a => a?.is_correct).length;
          const attemptedAnswers = questionAnswers.filter(a => a?.answer_text && a.answer_text.trim() !== '').length;
          
          return {
            questionText: question.question_text.substring(0, 100) + (question.question_text.length > 100 ? '...' : ''),
            questionType: question.question_type,
            totalMarks: question.marks,
            correctAnswers,
            attemptedAnswers,
            accuracy: attemptedAnswers > 0 ? (correctAnswers / attemptedAnswers * 100) : 0,
            averageMarks: questionAnswers.reduce((sum, a) => sum + (a?.marks_obtained || 0), 0) / questionAnswers.length || 0
          };
        })
      };

      // Performance by score ranges
      const scoreRanges = [
        { range: '0-20', min: 0, max: 20, count: 0 },
        { range: '21-40', min: 21, max: 40, count: 0 },
        { range: '41-60', min: 41, max: 60, count: 0 },
        { range: '61-80', min: 61, max: 80, count: 0 },
        { range: '81-100', min: 81, max: 100, count: 0 }
      ];

      quizSubmissions.forEach(submission => {
        const score = submission.score || 0;
        const range = scoreRanges.find(r => score >= r.min && score <= r.max);
        if (range) range.count++;
      });

      const reportData = {
        quizInfo: {
          title: quiz.title,
          description: quiz.description,
          subject: quiz.subject,
          duration: quiz.duration_minutes,
          totalMarks: quiz.total_marks,
          questionCount: questions.length,
          createdAt: quiz.created_at,
          publishedAt: quiz.published_at
        },
        statistics,
        scoreDistribution: scoreRanges,
        submissions: detailedSubmissions,
        questions,
        generatedAt: new Date().toISOString()
      };

      if (format === 'json') {
        // Export as JSON
        const dataStr = JSON.stringify(reportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `TestReport_${quiz.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        console.log(`Exported test report for ${quiz.title} as JSON`);
      } else if (format === 'csv') {
        // Export as CSV
        let csvContent = "Test Report: " + quiz.title + "\n\n";
        csvContent += "Generated: " + new Date().toLocaleString() + "\n\n";
        
        // Quiz Information
        csvContent += "Quiz Information\n";
        csvContent += "Title," + quiz.title + "\n";
        csvContent += "Subject," + quiz.subject + "\n";
        csvContent += "Duration (minutes)," + quiz.duration_minutes + "\n";
        csvContent += "Total Marks," + quiz.total_marks + "\n";
        csvContent += "Number of Questions," + questions.length + "\n\n";
        
        // Statistics
        csvContent += "Statistics\n";
        csvContent += "Total Submissions," + statistics.totalSubmissions + "\n";
        csvContent += "Average Score (%)," + statistics.averageScore.toFixed(2) + "\n";
        csvContent += "Highest Score (%)," + statistics.highestScore + "\n";
        csvContent += "Lowest Score (%)," + statistics.lowestScore + "\n";
        csvContent += "Pass Rate (%)," + statistics.passRate.toFixed(2) + "\n";
        csvContent += "Average Time (minutes)," + statistics.averageTimeTaken.toFixed(2) + "\n\n";
        
        // Score Distribution
        csvContent += "Score Distribution\n";
        csvContent += "Range,Count\n";
        scoreRanges.forEach(range => {
          csvContent += range.range + "," + range.count + "\n";
        });
        csvContent += "\n";
        
        // Question Analysis
        csvContent += "Question Analysis\n";
        csvContent += "Question,Type,Marks,Correct,Attempted,Accuracy (%),Average Marks\n";
        statistics.questionAnalysis.forEach(qa => {
          csvContent += `"${qa.questionText}",${qa.questionType},${qa.totalMarks},${qa.correctAnswers},${qa.attemptedAnswers},${qa.accuracy.toFixed(2)},${qa.averageMarks.toFixed(2)}\n`;
        });
        csvContent += "\n";
        
        // Student Results
        csvContent += "Student Results\n";
        csvContent += "Student Name,Index Number,Score (%),Status,Submitted At,Time Taken (minutes),Questions Answered\n";
        detailedSubmissions.forEach(submission => {
          const timeTaken = submission.started_at && submission.submitted_at 
            ? ((new Date(submission.submitted_at).getTime() - new Date(submission.started_at).getTime()) / 1000 / 60).toFixed(2)
            : 'N/A';
          csvContent += `"${submission.student_name}","${submission.index_number || 'N/A'}",${submission.score || 0},${submission.status},${submission.submitted_at || 'N/A'},${timeTaken},${submission.answeredQuestions}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `TestReport_${quiz.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`Exported test report for ${quiz.title} as CSV`);
      } else if (format === 'pdf') {
        // For PDF, we'll create a formatted text version that can be converted to PDF
        let pdfContent = "TEST REPORT\n\n";
        pdfContent += "Quiz: " + quiz.title + "\n";
        pdfContent += "Subject: " + quiz.subject + "\n";
        pdfContent += "Generated: " + new Date().toLocaleString() + "\n\n";
        
        pdfContent += "QUIZ INFORMATION\n";
        pdfContent += "Duration: " + quiz.duration_minutes + " minutes\n";
        pdfContent += "Total Marks: " + quiz.total_marks + "\n";
        pdfContent += "Number of Questions: " + questions.length + "\n\n";
        
        pdfContent += "STATISTICS\n";
        pdfContent += "Total Submissions: " + statistics.totalSubmissions + "\n";
        pdfContent += "Average Score: " + statistics.averageScore.toFixed(2) + "%\n";
        pdfContent += "Highest Score: " + statistics.highestScore + "%\n";
        pdfContent += "Lowest Score: " + statistics.lowestScore + "%\n";
        pdfContent += "Pass Rate: " + statistics.passRate.toFixed(2) + "%\n";
        pdfContent += "Average Time: " + statistics.averageTimeTaken.toFixed(2) + " minutes\n\n";
        
        pdfContent += "SCORE DISTRIBUTION\n";
        scoreRanges.forEach(range => {
          pdfContent += range.range + ": " + range.count + " students\n";
        });
        pdfContent += "\n";
        
        pdfContent += "QUESTION ANALYSIS\n";
        statistics.questionAnalysis.forEach((qa, index) => {
          pdfContent += "Q" + (index + 1) + ": " + qa.questionText + "\n";
          pdfContent += "  Type: " + qa.questionType + ", Marks: " + qa.totalMarks + "\n";
          pdfContent += "  Correct: " + qa.correctAnswers + "/" + qa.attemptedAnswers + " (" + qa.accuracy.toFixed(2) + "%)\n";
          pdfContent += "  Average Marks: " + qa.averageMarks.toFixed(2) + "\n\n";
        });
        
        pdfContent += "STUDENT RESULTS\n";
        detailedSubmissions.forEach(submission => {
          const timeTaken = submission.started_at && submission.submitted_at 
            ? ((new Date(submission.submitted_at).getTime() - new Date(submission.started_at).getTime()) / 1000 / 60).toFixed(2)
            : 'N/A';
          pdfContent += submission.student_name + " (" + (submission.index_number || 'N/A') + ")\n";
          pdfContent += "  Score: " + (submission.score || 0) + "%\n";
          pdfContent += "  Status: " + submission.status + "\n";
          pdfContent += "  Submitted: " + (submission.submitted_at || 'N/A') + "\n";
          pdfContent += "  Time: " + timeTaken + " minutes\n";
          pdfContent += "  Questions Answered: " + submission.answeredQuestions + "/" + questions.length + "\n\n";
        });
        
        // Create a simple text file for now (can be enhanced with proper PDF library)
        const blob = new Blob([pdfContent], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `TestReport_${quiz.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        console.log(`Exported test report for ${quiz.title} as text file`);
      }
      
      alert(`Test report for "${quiz.title}" exported successfully as ${format.toUpperCase()}!`);
    } catch (error) {
      console.error('Error exporting test report:', error);
      alert('Error exporting test report. Please try again.');
    }
  };

  // Export all submissions data to JSON
  const exportAllSubmissionsJSON = async () => {
    try {
      const allData = filteredSubmissions.map(submission => {
        const quiz = quizzes.find(q => q.id === submission.quiz_id);
        return {
          studentName: submission.student_name || 'Unknown',
          indexNumber: submission.index_number || 'Unknown',
          quizTitle: submission.quiz_title || 'Unknown',
          quizSubject: quiz?.subject || 'Unknown',
          quizDuration: `${quiz?.duration_minutes || 0} minutes`, // Added "minutes" unit
          score: typeof submission.score === 'number' ? Number(submission.score.toFixed(2)) : 0,
          status: submission.status || 'Unknown',
          startedAt: submission.started_at,
          submittedAt: submission.submitted_at,
          gradedAt: submission.graded_at,
          cheated: submission.cheated || false,
          cheatingReason: submission.cheating_reason || '',
          tabSwitchCount: submission.tab_switch_count || 0,
          copyAttempts: submission.copy_attempts || 0,
          rightClickCount: submission.right_click_count || 0,
          quizId: submission.quiz_id || 'Unknown',
          attemptId: submission.id || 'Unknown',
          quiz: {
            id: quiz?.id,
            title: quiz?.title,
            description: quiz?.description,
            subject: quiz?.subject,
            duration_minutes: quiz?.duration_minutes,
            total_marks: quiz?.total_marks,
            status: quiz?.status,
            deadline: quiz?.deadline,
            created_at: quiz?.created_at
          }
        };
      });

      // Download JSON file
      const jsonContent = JSON.stringify(allData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `all_submissions_data_${timestamp}.json`;
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`Exported ${allData.length} submissions to JSON`);
    } catch (error) {
      console.error('Error exporting all submissions data:', error);
      alert('Error exporting data. Please try again.');
    }
  };
  const exportStudentResultPDF = async (submission: SubmissionRow) => {
    try {
      // Get detailed answers for this submission
      const answers = await db.getStudentAnswers(submission.id);
      const quiz = quizzes.find(q => q.id === submission.quiz_id);
      
      if (!quiz) {
        alert('Quiz not found');
        return;
      }

      // Get questions for this quiz
      const questions = await db.getQuestions(submission.quiz_id);

      // Format answers for PDF
      const formattedAnswers = answers.map(answer => {
        const question = questions.find(q => q.id === answer.question_id);
        return {
          questionText: question?.question_text || 'Unknown question',
          studentAnswer: answer.answer_text,
          correctAnswer: question?.correct_answer,
          marks: question?.marks || 0,
          obtainedMarks: answer.marks_obtained || 0,
          isCorrect: answer.is_correct || false
        };
      });

      // Score is already stored as a percentage, but we need actual total marks
      const percentage = parseFloat(String(submission.score ?? 0));
      const totalMarks = quiz?.total_marks || 100; // Get actual total marks from quiz

      const resultData: StudentResultPDF = {
        studentName: submission.student_name || 'Unknown Student',
        studentEmail: submission.student_id || 'unknown@example.com',
        quizTitle: submission.quiz_title || 'Unknown Quiz',
        subject: quiz?.subject || 'Unknown Subject',
        score: percentage,
        totalMarks: totalMarks,
        percentage: percentage,
        status: submission.status || 'Unknown',
        submittedAt: submission.submitted_at ? new Date(submission.submitted_at).toLocaleString() : 'Not submitted',
        gradedAt: submission.graded_at ? new Date(submission.graded_at).toLocaleString() : undefined,
        cheated: submission.cheated || false,
        cheatingReason: submission.cheating_reason || '',
        tabSwitchCount: submission.tab_switch_count || 0,
        copyAttempts: submission.copy_attempts || 0,
        rightClickCount: submission.right_click_count || 0,
        answers: formattedAnswers
      };

      // Debug logging
      console.log('PDF Export Data:', resultData);
      console.log('Original Submission:', submission);
      console.log('Quiz Data:', quiz);

      pdfExporter.exportStudentResult(resultData);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    }
  };

  const columns = [
    {
      key: 'student_name',
      header: 'Student Name',
    },
    {
      key: 'index_number',
      header: 'Index Number',
    },
    {
      key: 'quiz_title',
      header: 'Quiz Name',
    },
    {
      key: 'submitted_at',
      header: 'Submission Date',
      render: (value: string) => value ? new Date(value).toLocaleString() : 'In Progress',
    },
    {
      key: 'score',
      header: 'Score',
      render: (value: any) => {
        if (value === null || value === undefined) return '-';
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        return isNaN(numValue) ? '-' : `${numValue.toFixed(2)}%`;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => {
        const variants: any = {
          in_progress: 'warning',
          submitted: 'secondary',
          graded: 'success',
          expired: 'danger',
        };
        const labels: any = {
          in_progress: 'In Progress',
          submitted: 'Submitted',
          graded: 'Graded',
          expired: '⏰ Expired',
        };
        return <Badge variant={variants[value] || 'secondary'}>{labels[value] || value}</Badge>;
      },
    },
    {
      key: 'cheated',
      header: 'Academic Integrity',
      render: (value: boolean, row: SubmissionRow) => {
        if (value) {
          return (
            <div className="space-y-1">
              <Badge variant="danger" className="text-xs">
                ⚠️ Cheating Detected
              </Badge>
              {row.cheating_reason && (
                <div className="text-xs text-red-600 max-w-xs">
                  {row.cheating_reason}
                </div>
              )}
              <div className="text-xs text-gray-500 space-y-1">
                <div>Tab switches: {row.tab_switch_count || 0}</div>
                <div>Copy attempts: {row.copy_attempts || 0}</div>
                <div>Right clicks: {row.right_click_count || 0}</div>
              </div>
            </div>
          );
        } else {
          return (
            <Badge variant="success" className="text-xs">
              ✅ Integrity Maintained
            </Badge>
          );
        }
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, row: SubmissionRow) => (
        <div className="flex gap-2 flex-wrap">
          {(row.status === 'in_progress' || (row.status as any) === 'expired') && (
            <Button
              size="sm"
              variant="danger"
              onClick={(e) => { e.stopPropagation(); forceSubmitAttempt(row); }}
              className="flex items-center gap-1 text-xs"
            >
              ⚡ Force Submit
            </Button>
          )}
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); exportStudentResultPDF(row); }}
            className="flex items-center gap-1"
          >
            <FileText size={16} />
            PDF
          </Button>
        </div>
      ),
    },
  ];

  // Pagination calculations
  const totalPages = Math.ceil(filteredSubmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredSubmissions.slice(startIndex, endIndex);

  // Pagination controls
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const getPaginationNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Student Submissions</h1>
        <div className="flex gap-2">
          {/* Test Report Export Button */}
          <div className="relative">
            <button
              onClick={() => {
                if (filterQuiz !== 'all') {
                  exportTestReport(filterQuiz, 'csv');
                } else {
                  alert('Please select a specific quiz to generate a test report. Use the quiz filter above.');
                }
              }}
              disabled={filteredSubmissions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText size={18} />
              Test Report
            </button>
          </div>
          
          {/* Regrade All Button */}
          {/*
          <div className="relative">
            <button
              onClick={() => {
                if (filterQuiz !== 'all') {
                  regradeAllAttempts(filterQuiz);
                } else {
                  alert('Please select a specific quiz to recalculate scores. Use the quiz filter above.');
                }
              }}
              disabled={filteredSubmissions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertTriangle size={18} />
              Recalculate Scores
            </button>
          </div>
          */}

          {/* General Export Dropdown */}
          <div className="relative export-dropdown">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <FileSpreadsheet size={18} />
              Export All Data
              <ChevronDown size={16} className={`transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showExportDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      exportToCSV();
                      setShowExportDropdown(false);
                    }}
                    disabled={filteredSubmissions.length === 0}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FileSpreadsheet size={16} />
                    Export Student Results (CSV)
                  </button>
                  <button
                    onClick={() => {
                      exportAllSubmissionsData();
                      setShowExportDropdown(false);
                    }}
                    disabled={filteredSubmissions.length === 0}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Database size={16} />
                    Export All Submissions (CSV)
                  </button>
                  <button
                    onClick={() => {
                      exportAllSubmissionsJSON();
                      setShowExportDropdown(false);
                    }}
                    disabled={filteredSubmissions.length === 0}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FileText size={16} />
                    Export All Submissions (JSON)
                  </button>
                  
                  {/* Test Report Export Section */}
                  {(filterQuiz !== 'all' || quizzes.length > 0) && (
                    <>
                      <div className="border-t border-gray-200 my-1"></div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Test Reports
                      </div>
                      
                      {filterQuiz !== 'all' ? (
                        <>
                          <div className="px-4 py-1 text-xs text-gray-600">
                            Export for: {quizzes.find(q => q.id === filterQuiz)?.title || 'Selected Quiz'}
                          </div>
                          <button
                            onClick={() => {
                              exportTestReport(filterQuiz, 'json');
                              setShowExportDropdown(false);
                            }}
                            disabled={filteredSubmissions.length === 0}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <FileText size={16} />
                            Export Test Report (JSON)
                          </button>
                          <button
                            onClick={() => {
                              exportTestReport(filterQuiz, 'csv');
                              setShowExportDropdown(false);
                            }}
                            disabled={filteredSubmissions.length === 0}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <FileSpreadsheet size={16} />
                            Export Test Report (CSV)
                          </button>
                          <button
                            onClick={() => {
                              exportTestReport(filterQuiz, 'pdf');
                              setShowExportDropdown(false);
                            }}
                            disabled={filteredSubmissions.length === 0}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <FileText size={16} />
                            Export Test Report (PDF)
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-2 text-xs text-gray-500">
                          Select a specific quiz to export test reports
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-col md:flex-row gap-4">
          <Select
            value={filterQuiz}
            onChange={(e) => setFilterQuiz(e.target.value)}
            options={[
              { value: 'all', label: 'All Quizzes' },
              ...quizzes.map(q => ({ value: q.id, label: q.title })),
            ]}
          />
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'expired', label: '⏰ Expired' },
              { value: 'submitted', label: 'Submitted' },
              { value: 'graded', label: 'Graded' },
            ]}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Items per page:</label>
          <Select
            value={itemsPerPage.toString()}
            onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
            options={[
              { value: '5', label: '5' },
              { value: '10', label: '10' },
              { value: '25', label: '25' },
              { value: '50', label: '50' },
              { value: '100', label: '100' },
            ]}
          />
        </div>
      </div>

      {/* Expired attempts alert banner */}
      {expiredAttempts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 text-red-700 flex-1">
            <AlertTriangle size={18} className="shrink-0" />
            <span className="text-sm font-medium">
              {expiredAttempts.length} student{expiredAttempts.length > 1 ? 's' : ''} ran out of time without submitting. Their saved answers have not been graded yet.
            </span>
          </div>
          <button
            onClick={forceGradeExpired}
            disabled={forceGrading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            {forceGrading ? (
              <><span className="animate-spin">⏳</span> Grading...</>
            ) : (
              <><CheckCircle size={16} /> Force Grade Expired</>
            )}
          </button>
        </div>
      )}

      {gradeResult && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
          <CheckCircle size={16} />
          Done! Graded {gradeResult.graded} attempt(s){gradeResult.failed > 0 ? `, ${gradeResult.failed} failed (check console)` : ''}.
        </div>
      )}

      <div className="text-sm text-gray-600">
        Showing {startIndex + 1} to {Math.min(endIndex, filteredSubmissions.length)} of {filteredSubmissions.length} submissions
      </div>

      <Table
        columns={columns}
        data={paginatedData}
        onRowClick={(row) => navigate(`/lecturer/submission/${row.id}`)}
        emptyMessage="No submissions yet"
      />

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1"
            >
              Previous
            </Button>
            
            <div className="flex gap-1">
              {getPaginationNumbers().map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
