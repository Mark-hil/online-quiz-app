import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './ui/Loading';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    const redirectTarget = `${location.pathname}${location.search}`;
    const loginPath =
      redirectTarget && redirectTarget !== '/' && redirectTarget !== '/login'
        ? `/login?redirect=${encodeURIComponent(redirectTarget)}`
        : '/login';
    return <Navigate to={loginPath} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
