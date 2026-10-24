import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, User } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    name: string,
    role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin',
    index_number?: string
  ) => Promise<void>;
  signIn: (emailOrIndex: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(auth.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();

    const handleSessionExpired = () => {
      setUser(null);
    };

    window.addEventListener('auth:session_expired', handleSessionExpired);
    return () => {
      window.removeEventListener('auth:session_expired', handleSessionExpired);
    };
  }, []);

  const loadUser = async () => {
    try {
      const userData = await auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Error verifying user session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin',
    index_number?: string
  ) => {
    const response = await auth.signUp(email, password, name, role, index_number);
    setUser(response.user);
  };

  const signIn = async (emailOrIndex: string, password: string) => {
    const response = await auth.signIn(emailOrIndex, password);
    setUser(response.user);
  };

  const signOut = async () => {
    await auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
