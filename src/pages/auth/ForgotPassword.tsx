import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { db } from '../../lib/database';
import { ConsoleEmailService } from '../../lib/email';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if user exists
      const profiles = await db.getProfiles();
      const user = profiles.find(p => p.email === email);

      if (!user) {
        setError('No account found with this email address.');
        return;
      }

      // Generate a reset token (in production, use crypto library)
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      // const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now - for production use

      // Save reset token to database (for production)
      // await db.createPasswordResetToken(email, token, expiresAt);

      // Send password reset email
      const emailService = new ConsoleEmailService();
      await emailService.sendPasswordResetEmail(email, token, user.name);

      setResetToken(token);
      setSuccess(true);
    } catch (error) {
      console.error('Password reset error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const resetLink = `${window.location.origin}/reset-password?token=${resetToken}`;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="text-green-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Reset Link Generated
            </h2>
            <p className="text-gray-600 mb-6">
              We've generated a password reset link for your email address.
            </p>
            
            <div className="bg-blue-50 p-4 rounded-lg mb-6 text-left">
              <p className="text-sm text-blue-800 font-medium mb-2">🔧 Development Mode:</p>
              <p className="text-xs text-blue-700 mb-3">
                In production, an email would be sent to <strong>{email}</strong>
              </p>
              <p className="text-xs text-blue-700 font-medium mb-2">For testing, use this link:</p>
              <div className="bg-white p-2 rounded border border-blue-200">
                <a 
                  href={resetLink} 
                  className="text-xs text-blue-600 hover:text-blue-800 break-all"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {resetLink}
                </a>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                💡 Check the browser console for more details
              </p>
            </div>

            <div className="space-y-3">
              <a href={resetLink}>
                <Button className="w-full">
                  Go to Reset Password
                </Button>
              </a>
              <Link to="/login">
                <Button variant="secondary" className="w-full">
                  Return to Login
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-8">
          <Link to="/login" className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
            <ArrowLeft size={20} className="mr-2" />
            Back to Login
          </Link>
          
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
              <Mail className="text-blue-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Forgot Password?
            </h2>
            <p className="text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Remember your password?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
