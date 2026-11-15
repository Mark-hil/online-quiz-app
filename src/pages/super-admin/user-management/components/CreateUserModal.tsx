import { useState, FormEvent } from 'react';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import { UserRole } from '../types';

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  indexNumber?: string;
}

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload) => Promise<boolean>;
  isSubmitting?: boolean;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: CreateUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('lecturer');
  const [indexNumber, setIndexNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('lecturer');
    setIndexNumber('');
    setPassword('');
    setShowPassword(false);
    setFormError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('A valid email address is required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Temporary password must be at least 8 characters.');
      return;
    }

    const ok = await onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      password,
      indexNumber: role === 'student' && indexNumber.trim() ? indexNumber.trim() : undefined,
    });

    if (ok) {
      resetForm();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Provision New User" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-gray-600">
          Directly create a staff, academic officer, moderator, or student account with a temporary password.
        </p>

        {formError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {formError}
          </div>
        )}

        <Input
          label="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Dr. Jane Doe"
          required
        />

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jane.doe@institution.edu"
          required
        />

        <Select
          label="Assigned Role"
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          options={[
            { value: 'lecturer', label: 'Lecturer (Faculty)' },
            { value: 'moderator', label: 'Moderator (Reviewer)' },
            { value: 'admin', label: 'Academic Officer (Admin)' },
            { value: 'student', label: 'Student (Learner)' },
            { value: 'super_admin', label: 'Super Admin (Root)' },
          ]}
        />

        {role === 'student' && (
          <Input
            label="Index Number (Optional)"
            value={indexNumber}
            onChange={(e) => setIndexNumber(e.target.value)}
            placeholder="e.g., CS/2026/001"
          />
        )}

        <div className="relative">
          <Input
            label="Temporary Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <UserPlus size={16} className="mr-1.5" />
            {isSubmitting ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

