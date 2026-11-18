import { useState, useEffect, FormEvent } from 'react';
import { KeyRound, Eye, EyeOff, Copy, Check, Sparkles, Hash, Mail } from 'lucide-react';
import Modal from '../../../../components/ui/Modal';
import Button from '../../../../components/ui/Button';
import Input from '../../../../components/ui/Input';
import UserRoleBadge from './UserRoleBadge';
import { User } from '../types';

interface ResetUserPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSubmit: (newPassword: string) => Promise<boolean>;
  isSubmitting?: boolean;
}

function generateExamRoomPassword(): string {
  const digits = '23456789';
  let code = 'Exam';
  for (let i = 0; i < 4; i++) {
    code += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return code;
}

export default function ResetUserPasswordModal({
  isOpen,
  onClose,
  user,
  onSubmit,
  isSubmitting = false,
}: ResetUserPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      setNewPassword(generateExamRoomPassword());
      setShowPassword(true);
      setCopied(false);
      setFormError(null);
    }
  }, [isOpen, user]);

  if (!user) return null;

  const handleCopy = async () => {
    if (!newPassword.trim()) return;
    try {
      await navigator.clipboard.writeText(newPassword.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const clean = newPassword.trim();
    if (clean.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    await onSubmit(clean);
  };

  const canUseIndex = Boolean(user.index_number && user.index_number.trim().length >= 6);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Exam-Room Password Reset"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-gray-900 text-sm">{user.name}</div>
              <div className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <Mail size={12} className="text-gray-400" />
                {user.email}
              </div>
              {user.index_number && (
                <div className="text-xs text-gray-700 font-mono flex items-center gap-1 mt-1">
                  <Hash size={12} className="text-gray-400" />
                  Index: <span className="font-semibold">{user.index_number}</span>
                </div>
              )}
            </div>
            <UserRoleBadge role={user.role} />
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed pt-1 border-t border-amber-200/70">
            Set a new password below and share it directly with the student in the exam room so they can sign in immediately.
          </p>
        </div>

        {formError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            {formError}
          </div>
        )}

        {/* Quick Presets for Exam Hall */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
            Quick Exam-Room Presets
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setNewPassword(generateExamRoomPassword());
                setFormError(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
            >
              <Sparkles size={13} />
              Generate Exam Code
            </button>

            {canUseIndex && (
              <button
                type="button"
                onClick={() => {
                  setNewPassword(user.index_number!.trim());
                  setFormError(null);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
              >
                <Hash size={13} />
                Use Index ({user.index_number!.trim()})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setNewPassword('student123');
                setFormError(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 transition-colors"
            >
              Use &ldquo;student123&rdquo;
            </button>
          </div>
        </div>

        {/* Password Input with Show/Hide & Copy */}
        <div className="space-y-1.5">
          <div className="relative">
            <Input
              label="New Temporary Password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setFormError(null);
              }}
              placeholder="Minimum 6 characters"
              className="font-mono text-base pr-20"
              required
            />
            <div className="absolute right-2 top-8 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                title="Copy password"
              >
                {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
              </button>
            </div>
          </div>
          {copied && (
            <p className="text-[11px] text-emerald-600 font-medium">
              Copied password to clipboard!
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            <KeyRound size={16} className="mr-1.5" />
            {isSubmitting ? 'Resetting...' : 'Reset Password Now'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

