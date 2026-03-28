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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
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
    // Lecturers should NOT be able to publish directly
    // Only moderators can approve and admins can publish
    // Lecturers can only submit for approval
    if (quiz.status === 'draft') {
      if (!confirm('Are you sure you want to submit this quiz for moderation?')) return;
      
      // Submit for approval
      try {
        await db.submitForApproval(quiz.id);
        loadQuizzes();
      } catch (error) {
        console.error('Error submitting quiz for approval:', error);
      }
    } else {
      // Lecturers cannot modify approved/published quizzes
      alert('Only moderators can approve and admins can publish quizzes. You can only submit drafts for approval.');
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

  // Pagination calculations
  const totalPages = Math.ceil(quizzes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedQuizzes = quizzes.slice(startIndex, endIndex);

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">My Quizzes</h1>
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Items per page:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={3}>3</option>
              <option value={6}>6</option>
              <option value={9}>9</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
            </select>
          </div>
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
        <>
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1} to {Math.min(endIndex, quizzes.length)} of {quizzes.length} quizzes
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedQuizzes.map((quiz) => (
              <Card key={quiz.id} hover>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-gray-900 flex-1">
                      {quiz.title}
                    </h3>
                    <Badge variant={
                      quiz.status === 'published' ? 'success' : 
                      quiz.status === 'approved' ? 'warning' : 
                      quiz.status === 'pending_approval' ? 'info' : 'secondary'
                    }>
                      {quiz.status === 'pending_approval' ? 'Pending Approval' : 
                       quiz.status === 'approved' ? 'Approved' : 
                       quiz.status === 'published' ? 'Published' : 'Draft'}
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
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/lecturer/create-quiz?id=${quiz.id}`)}
                        className="text-gray-600 hover:text-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Edit"
                        disabled={quiz.status === 'published' && quiz.status !== 'rejected'}
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title="Delete"
                        disabled={quiz.status !== 'draft'}
                      >
                        <Trash2 size={18} />
                      </button>
                      {quiz.status === 'draft' && (
                        <button
                          onClick={() => handleToggleStatus(quiz)}
                          className="px-3 py-1 text-xs font-medium rounded-md transition-colors bg-blue-100 text-blue-700 hover:bg-blue-200"
                        >
                          Submit for Approval
                        </button>
                      )}
                      {quiz.status === 'pending_approval' && (
                        <div className="px-3 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-700">
                          Pending Review
                        </div>
                      )}
                      {quiz.status === 'approved' && (
                        <div className="px-3 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700">
                          Approved - Awaiting Publication
                        </div>
                      )}
                      {quiz.status === 'published' && (
                        <div className="px-3 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-700">
                          Published
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
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
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
