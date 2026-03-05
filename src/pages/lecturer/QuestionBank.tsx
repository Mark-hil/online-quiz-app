import { useState, useEffect } from 'react';
import { Trash2, Edit2, Search } from 'lucide-react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { db, Question } from '../../lib/database';
import { useAuth } from '../../contexts/AuthContext';

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const { user } = useAuth();

  useEffect(() => {
    loadQuestions();
  }, []);

  useEffect(() => {
    let filtered = questions;

    if (searchTerm) {
      filtered = filtered.filter(q =>
        q.question_text.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(q => q.question_type === filterType);
    }

    setFilteredQuestions(filtered);
  }, [searchTerm, filterType, questions]);

  const loadQuestions = async () => {
    if (!user) return;

    const data = await db.getQuestions(undefined, user.id);
    setQuestions(data as Question[]);
    setFilteredQuestions(data as Question[]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      await db.deleteQuestion(id);
      loadQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'mcq', label: 'Multiple Choice' },
              { value: 'true_false', label: 'True/False' },
              { value: 'essay', label: 'Essay' },
            ]}
          />
        </div>

        {filteredQuestions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No questions found</p>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((question) => (
              <div
                key={question.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{question.question_type}</Badge>
                      <Badge variant="primary">{question.marks} marks</Badge>
                      {question.quiz_id && (
                        <Badge variant="success">In Quiz</Badge>
                      )}
                    </div>
                    <p className="text-gray-900 mb-2">{question.question_text}</p>
                    {question.question_type === 'mcq' && question.options && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Correct Answer:</span> {question.correct_answer}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button className="text-blue-600 hover:text-blue-700">
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
