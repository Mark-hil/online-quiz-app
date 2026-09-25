import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../lib/auth';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { LoadingButton } from '../../components/ui/Loading';

type AllowedSignupRole = 'student' | 'lecturer' | 'super_admin';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<AllowedSignupRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isBootstrapAvailable, setIsBootstrapAvailable] = useState<boolean>(false);
  const [, setCheckingBootstrap] = useState<boolean>(true);

  const { signUp } = useAuth();
  const navigate = useNavigate();

  // Check if system is in First-Run Bootstrap mode (0 Super Admins)
  useEffect(() => {
    let isMounted = true;
    async function checkBootstrapMode() {
      try {
        const available = await auth.isBootstrapAvailable();
        if (isMounted) {
          setIsBootstrapAvailable(available);
        }
      } catch (err) {
        console.error('Error checking bootstrap availability:', err);
      } finally {
        if (isMounted) {
          setCheckingBootstrap(false);
        }
      }
    }
    checkBootstrapMode();
    return () => {
      isMounted = false;
    };
  }, []);

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

    if ((role === 'lecturer' || role === 'super_admin') && !email.trim()) {
      setError('Email is required');
      return;
    }

    if (role === 'super_admin' && !isBootstrapAvailable) {
      setError('Super Administrator self-registration is permanently closed.');
      return;
    }

    setLoading(true);

    try {
      await signUp(
        email.trim(),
        password,
        name.trim(),
        role,
        role === 'student' ? indexNumber.trim() : undefined
      );
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = [
    { value: 'student', label: 'Student (Learner)' },
    { value: 'lecturer', label: 'Lecturer (Faculty)' },
    ...(isBootstrapAvailable
      ? [
          {
            value: 'super_admin',
            label: '★ Super Administrator (First-Run Root Setup)',
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Sign up to get started</p>
          </div>

          {/* First-Run Bootstrap Banner */}
          {isBootstrapAvailable && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-900 flex items-start gap-2.5 mb-5">
              <Shield size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">System Initialization (First-Run Setup)</p>
                <p className="text-amber-800 mt-0.5 leading-relaxed">
                  No Super Administrator currently exists. First-Run Root Setup is open to configure the initial administrator. Once registered, public root registration will be permanently locked.
                </p>
              </div>
            </div>
          )}

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
                placeholder="Enter your student index number"
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

            <div>
              <Select
                label="Account Role"
                value={role}
                onChange={(e) => setRole(e.target.value as AllowedSignupRole)}
                options={roleOptions}
              />
              {!isBootstrapAvailable && (
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                  {/* <Info size={13} className="text-gray-400 flex-shrink-0" />
                  <span>Administrative and staff roles are provisioned by a Super Administrator.</span> */}
                </p>
              )}
            </div>

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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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
