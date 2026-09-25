import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Select from '../../../../components/ui/Select';
import { User, UserRole } from '../types';

interface EditUserRoleModalProps {
  isOpen: boolean;
  user: User | null;
  selectedRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function EditUserRoleModal({
  isOpen,
  user,
  selectedRole,
  onChangeRole,
  onConfirm,
  onClose,
  isSubmitting = false,
}: EditUserRoleModalProps) {
  if (!user) return null;

  const roleDescriptions: Record<UserRole, string> = {
    student: 'Can participate in scheduled quizzes, take assessments, and review results.',
    lecturer: 'Can create and manage quizzes, question banks, and view class performance.',
    moderator: 'Can review, approve, reject, or flag quizzes created by lecturers.',
    admin: 'Can manage users, oversee platform activity, and access administrative settings.',
    super_admin: 'Full unrestricted governance, system configurations, and audit management.',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update User Role" size="sm">
      <div className="space-y-5">
        {/* User Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Target Account</p>
          <p className="font-semibold text-gray-900 text-base">{user.name}</p>
          <p className="text-xs text-gray-600 font-mono mt-0.5">{user.email}</p>
          {user.index_number && (
            <p className="text-xs text-gray-500 mt-1">
              Index: <span className="font-mono font-medium text-gray-700">{user.index_number}</span>
            </p>
          )}
        </div>

        {/* Role Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assign New Role
          </label>
          <Select
            value={selectedRole}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
            options={[
              { value: 'student', label: 'Student (Learner)' },
              { value: 'lecturer', label: 'Lecturer (Faculty)' },
              { value: 'moderator', label: 'Moderator (Reviewer)' },
              { value: 'admin', label: 'Administrator (Operations)' },
              { value: 'super_admin', label: 'Super Admin (Root)' },
            ]}
          />
          <p className="text-xs text-gray-500 mt-2 bg-blue-50/50 p-2.5 rounded border border-blue-100">
            <span className="font-semibold text-blue-900">Permissions: </span>
            {roleDescriptions[selectedRole]}
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
