import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './ui/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
