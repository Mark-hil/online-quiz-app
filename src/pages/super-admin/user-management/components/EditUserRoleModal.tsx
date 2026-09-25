import { Shield, AlertCircle } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Select from '../../../../components/ui/Select';
import { User, UserRole } from '../types';
import { canAssignRole } from '../utils/rolePolicy';

interface EditUserRoleModalProps {
  isOpen: boolean;
  user: User | null;
  currentUser?: { id: string; role: UserRole } | null;
  selectedRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function EditUserRoleModal({
  isOpen,
  user,
  currentUser,
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

  const isSuperAdminTarget = user.role === 'super_admin';
  const isSelf = Boolean(currentUser?.id && currentUser.id === user.id);
  const policyCheck = canAssignRole(currentUser, user, selectedRole);

  const availableOptions: { value: UserRole; label: string }[] = [
    { value: 'student', label: 'Student (Learner)' },
    { value: 'lecturer', label: 'Lecturer (Faculty)' },
    { value: 'moderator', label: 'Moderator (Reviewer)' },
    { value: 'admin', label: 'Administrator (Operations)' },
    ...(currentUser?.role === 'super_admin'
      ? [{ value: 'super_admin' as UserRole, label: 'Super Admin (Root)' }]
      : []),
  ];

  const canSave = !isSuperAdminTarget && !isSelf && policyCheck.allowed && selectedRole !== user.role;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update User Role" size="sm">
      <div className="space-y-5">
        {/* User Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3.5">
          <p className="text-xs uppercase tracking-wider font-semibold text-gray-500 mb-1">Target Account</p>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900 text-base">{user.name}</p>
            {isSuperAdminTarget && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Shield size={12} className="text-blue-500" />
                Root Account
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 font-mono mt-0.5">{user.email}</p>
          {user.index_number && (
            <p className="text-xs text-gray-500 mt-1">
              Index: <span className="font-mono font-medium text-gray-700">{user.index_number}</span>
            </p>
          )}
        </div>

        {/* Protection notices */}
        {isSuperAdminTarget && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
            <Shield size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Protected Root Account</p>
              <p className="text-amber-800 mt-0.5">
                Super Admin accounts have permanent root privileges and cannot be demoted or modified.
              </p>
            </div>
          </div>
        )}

        {isSelf && !isSuperAdminTarget && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 flex items-start gap-2">
            <AlertCircle size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Self-Modification Restriction</p>
              <p className="text-gray-600 mt-0.5">
                You cannot modify your own assigned account role.
              </p>
            </div>
          </div>
        )}

        {/* Role Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Assign New Role
          </label>
          <Select
            value={selectedRole}
            disabled={isSuperAdminTarget || isSelf || isSubmitting}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
            options={availableOptions}
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
          <Button onClick={onConfirm} disabled={!canSave || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Role'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
