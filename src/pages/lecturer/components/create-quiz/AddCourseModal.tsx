import React, { useState, FormEvent } from 'react';
import Modal from '../../../../components/ui/Modal';
import Input from '../../../../components/ui/Input';
import Button from '../../../../components/ui/Button';
import { db, Course } from '../../../../lib/database';

interface AddCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onCourseCreated: (newCourse: Course) => void;
}

export const AddCourseModal: React.FC<AddCourseModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onCourseCreated,
}) => {
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [assignSelf, setAssignSelf] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !title.trim()) return;

    setLoading(true);
    try {
      const created = await db.createCourse({
        code: code.trim().toUpperCase(),
        title: title.trim(),
        department: department.trim() || undefined,
        assigned_lecturer_id: assignSelf ? userId : undefined,
      });

      onCourseCreated(created);
      setCode('');
      setTitle('');
      setDepartment('');
      onClose();
    } catch (err: any) {
      console.error('Error creating course:', err);
      alert(err.message || 'Failed to create course. Code may already exist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register New Institutional Course">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-500">
          Create an institutional course code context for question bank indexing, moderation, and student enrollment.
        </p>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Course Code <span className="text-rose-500">*</span>
          </label>
          <Input
            required
            placeholder="e.g. CS101, INFO205, MATH110"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Course Title <span className="text-rose-500">*</span>
          </label>
          <Input
            required
            placeholder="e.g. Introduction to Programming and Algorithmic Thinking"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Department (Optional)
          </label>
          <Input
            placeholder="e.g. Computer Science, Information Systems"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={assignSelf}
              onChange={(e) => setAssignSelf(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <span>Assign myself ({userName}) as Lead Lecturer for this course</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading || !code.trim() || !title.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4"
          >
            {loading ? 'Registering...' : 'Register Course'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
