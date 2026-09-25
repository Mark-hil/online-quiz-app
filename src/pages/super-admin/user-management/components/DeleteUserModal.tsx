import { AlertTriangle } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import { User } from '../types';

interface DeleteUserModalProps {
  isOpen: boolean;
  user: User | null;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export default function DeleteUserModal({
  isOpen,
  user,
  onConfirm,
  onClose,
  isSubmitting = false,
}: DeleteUserModalProps) {
  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Delete User" size="sm">
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-semibold text-red-900">
              Permanently delete user profile?
            </p>
            <p className="text-xs text-red-700 mt-1">
              You are about to remove <strong>{user.name}</strong> ({user.email}). All linked session states and role permissions will be revoked immediately. This action cannot be reversed.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Deleting...' : 'Delete User'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
