import { useState, useEffect } from 'react';
import { Flag, Search, CheckCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { db } from '../../lib/database';

export default function FlaggedQuestions() {
  const [flaggedAnswers, setFlaggedAnswers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await db.getFlaggedAnswersForAdmin();
      setFlaggedAnswers(data);
    } catch (error) {
      console.error('Failed to load flagged questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnflag = async (answerId: string) => {
    try {
      await db.updateStudentAnswer(answerId, { is_flagged: false });
      // Remove from UI
      setFlaggedAnswers(prev => prev.filter(a => a.id !== answerId));
    } catch (error) {
      console.error('Failed to unflag answer:', error);
      alert('Failed to update. Please try again.');
    }
  };

  const filteredAnswers = flaggedAnswers.filter(answer => 
    answer.quiz_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    answer.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    answer.question_text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-gray-600">Loading flagged questions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flag className="text-orange-500" />
            Flagged Questions
          </h1>
          <p className="text-gray-600 mt-1">
            Questions that students marked for review during their exams.
          </p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by student, quiz, or question..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 bg-orange-50 px-4 py-2 rounded-lg border border-orange-200 text-orange-800">
            <span className="font-semibold">{flaggedAnswers.length}</span>
            <span className="text-sm">Total Flagged</span>
          </div>
        </div>

        {filteredAnswers.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-2">No flagged questions found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAnswers.map((item) => (
              <div key={item.id} className="border border-orange-200 bg-white rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{item.quiz_title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                      <span className="font-medium">Student:</span> {item.student_name}
                      {item.student_index && <span>({item.student_index})</span>}
                    </div>
                  </div>
                  <Badge variant="warning">Flagged</Badge>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Question Text:</h4>
                    <p className="text-gray-800 bg-gray-50 p-3 rounded-md border border-gray-100">{item.question_text}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Student's Answer:</h4>
                    {item.answer_text ? (
                      <p className="text-gray-800 bg-blue-50 p-3 rounded-md border border-blue-100 whitespace-pre-wrap">{item.answer_text}</p>
                    ) : (
                      <p className="text-gray-400 italic text-sm">No answer provided yet.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    onClick={() => handleUnflag(item.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors border border-orange-200"
                  >
                    <CheckCircle size={16} />
                    Mark as Resolved (Unflag)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
