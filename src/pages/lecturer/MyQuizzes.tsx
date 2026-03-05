import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, Trash2, Eye, Upload, Calendar, Clock, BookOpen, AlertCircle, FileText } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Quiz } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';
import { pdfExporter, QuizData, QuizQuestion } from '../../utils/pdfExport';

export default function MyQuizzes() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    if (!user) return;

    const data = await db.getQuizzes(user.id);
    setQuizzes(data as Quiz[]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quiz? All questions and submissions will be deleted.')) return;

    try {
      await db.deleteQuiz(id);
      loadQuizzes();
    } catch (error) {
      console.error('Error deleting quiz:', error);
    }
  };

  const handleToggleStatus = async (quiz: Quiz) => {
    const newStatus = quiz.status === 'published' ? 'draft' : 'published';

    try {
      await db.updateQuiz(quiz.id, { status: newStatus });
      loadQuizzes();
    } catch (error) {
      console.error('Error updating quiz:', error);
    }
  };

  const handleExportQuizPDF = async (quiz: Quiz, includeAnswers: boolean = false) => {
    try {
      const questions = await db.getQuestions(quiz.id);
      
      // Format questions for PDF
      const formattedQuestions: QuizQuestion[] = questions.map(q => {
        let options;
        try {
          // Safely parse options, handle cases where it might not be valid JSON
          options = q.options ? JSON.parse(q.options as string) : undefined;
        } catch (error) {
          console.warn('Failed to parse options for question:', q.id, error);
          options = undefined;
        }

        return {
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type as 'multiple-choice' | 'true-false' | 'short-answer' | 'essay',
          options: options,
          correct_answer: includeAnswers ? q.correct_answer : undefined,
          marks: q.marks
        };
      });

      const quizData: QuizData = {
        title: quiz.title,
        description: quiz.description || '',
        subject: quiz.subject,
        duration_minutes: quiz.duration_minutes,
        total_marks: quiz.total_marks,
        questions: formattedQuestions,
        created_at: quiz.created_at,
        deadline: quiz.deadline || undefined
      };

      pdfExporter.exportQuiz(quizData, includeAnswers);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    }
  };

  const handleImportQuiz = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file type
    const fileName = file.name.toLowerCase();
    const isJSON = fileName.endsWith('.json');
    const isPDF = fileName.endsWith('.pdf');
    const isDOCX = fileName.endsWith('.docx');
    
    if (!isJSON && !isPDF && !isDOCX) {
      alert('Please select a JSON, PDF, or DOCX file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        if (!result || typeof result !== 'string') {
          throw new Error('File is empty or not readable');
        }

        // Trim whitespace and check if content is valid
        const trimmedResult = result.trim();
        if (!trimmedResult) {
          throw new Error('File is empty');
        }

        let quizData: any;

        if (isJSON) {
          // Check if it starts with { or [ for JSON
          if (!trimmedResult.startsWith('{') && !trimmedResult.startsWith('[')) {
            throw new Error('File does not contain valid JSON data');
          }

          console.log('Raw file content:', trimmedResult.substring(0, 200) + '...');
          quizData = JSON.parse(trimmedResult);
          
          // Validate required fields
          if (!quizData.title || !quizData.questions || !Array.isArray(quizData.questions)) {
            throw new Error('Invalid quiz format. Missing required fields: title and questions array');
          }
        } else if (isPDF) {
          // PDF parsing would require a PDF library - for now, show message
          throw new Error('PDF import is not yet supported. Please export your quiz as JSON and import that file.');
        } else if (isDOCX) {
          // DOCX parsing would require a document parsing library - for now, show message
          throw new Error('DOCX import is not yet supported. Please export your quiz as JSON and import that file.');
        } else {
          throw new Error('Unsupported file format');
        }

        const { questions, ...quizInfo } = quizData;

        const newQuiz = await db.createQuiz({
          lecturer_id: user.id,
          title: `${quizInfo.title} (Imported)`,
          description: quizInfo.description,
          subject: quizInfo.subject,
          duration_minutes: quizInfo.duration_minutes,
          total_marks: quizInfo.total_marks,
          status: 'draft',
        });

        const questionsToInsert = questions.map((q: any) => ({
          quiz_id: newQuiz.id,
          lecturer_id: user.id,
          question_text: q.question_text,
          question_type: q.question_type,
          options: q.options || [],
          correct_answer: q.correct_answer,
          marks: q.marks,
        }));

        // Insert questions one by one
        for (const question of questionsToInsert) {
          await db.createQuestion(question);
        }

        loadQuizzes();
        alert('Quiz imported successfully!');
      } catch (error) {
        console.error('Error importing quiz:', error);
        
        // Provide user-friendly error messages
        let errorMessage = 'Error importing quiz. Please check the file format and try again.';
        
        if (error instanceof Error) {
          if (error.message.includes('JSON.parse')) {
            errorMessage = 'Invalid JSON format. Please ensure the file contains valid JSON data.';
          } else if (error.message.includes('empty')) {
            errorMessage = 'File is empty. Please select a valid quiz file.';
          } else if (error.message.includes('Invalid quiz format')) {
            errorMessage = error.message;
          } else if (error.message.includes('valid JSON data')) {
            errorMessage = 'File does not contain valid JSON data. Please check the file content.';
          }
        }
        
        alert(errorMessage);
      }
    };
    if (isJSON) {
      reader.readAsText(file);
    } else if (isPDF) {
      reader.readAsText(file); // For now, try to read as text (won't work for actual PDF)
    } else if (isDOCX) {
      reader.readAsText(file); // For now, try to read as text (won't work for actual DOCX)
    } else {
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".json"
              onChange={handleImportQuiz}
              className="hidden"
            />
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200">
              <Upload size={18} />
              <span>Import Quiz</span>
            </div>
          </label>
          <Button onClick={() => navigate('/lecturer/create-quiz')}>
            Create Quiz
          </Button>
        </div>
      </div>

      {quizzes.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BookOpen className="mx-auto text-gray-400 mb-4" size={48} />
            <p className="text-gray-500 mb-4">No quizzes created yet</p>
            <Button onClick={() => navigate('/lecturer/create-quiz')}>
              Create Your First Quiz
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} hover>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold text-gray-900 flex-1">
                    {quiz.title}
                  </h3>
                  <Badge variant={quiz.status === 'published' ? 'success' : 'secondary'}>
                    {quiz.status}
                  </Badge>
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">
                  {quiz.description || 'No description'}
                </p>

                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} />
                    <span>{quiz.subject || 'No subject'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>{quiz.duration_minutes} minutes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                  </div>
                  {quiz.deadline && (
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} />
                      <span>Deadline: {new Date(quiz.deadline).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/lecturer/quiz/${quiz.id}/results`)}
                      className="text-blue-600 hover:text-blue-700"
                      title="View Results"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleExportQuizPDF(quiz, false)}
                      className="text-purple-600 hover:text-purple-700"
                      title="Export PDF (Student Copy)"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      onClick={() => handleExportQuizPDF(quiz, true)}
                      className="text-indigo-600 hover:text-indigo-700"
                      title="Export PDF (With Answers)"
                    >
                      <FileText size={18} />
                    </button>
                    <button
                      onClick={() => navigate(`/lecturer/edit-quiz/${quiz.id}`)}
                      className="text-gray-600 hover:text-gray-700"
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(quiz.id)}
                      className="text-red-600 hover:text-red-700"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleStatus(quiz)}
                    className={`text-xs font-medium px-3 py-1 rounded ${
                      quiz.status === 'published'
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {quiz.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
