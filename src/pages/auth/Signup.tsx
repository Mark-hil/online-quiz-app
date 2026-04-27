import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { LoadingButton } from '../../components/ui/Loading';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin'>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (role === 'student' && !indexNumber.trim()) {
      setError('Index number is required for students');
      return;
    }

    if ((role === 'moderator' || role === 'admin') && !email.trim()) {
      setError('Email is required for moderators and administrators');
      return;
    }

    setLoading(true);

    try {
      // Debug logging
      console.log('Submitting signup with:', { email, name, role, indexNumber });
      await signUp(email, password, name, role, role === 'student' ? indexNumber : undefined);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Sign up to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <Input
              label="Full Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />

            {role === 'student' && (
              <Input
                label="Index Number"
                type="text"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                placeholder="Enter your index number"
                required
              />
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <Select
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin')}
              options={[
                { value: 'student', label: 'Student' },
                { value: 'lecturer', label: 'Lecturer' },
                { value: 'moderator', label: 'Moderator' },
                { value: 'admin', label: 'Administrator' },
                { value: 'super_admin', label: 'Super Administrator' },
              ]}
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center mt-6"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="text-gray-400 hover:text-gray-600" size={20} />
                ) : (
                  <Eye className="text-gray-400 hover:text-gray-600" size={20} />
                )}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center mt-6"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="text-gray-400 hover:text-gray-600" size={20} />
                ) : (
                  <Eye className="text-gray-400 hover:text-gray-600" size={20} />
                )}
              </button>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <LoadingButton /> : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
