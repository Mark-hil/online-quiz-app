import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, User } from '../lib/auth';
import { runMigrations } from '../lib/database';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string, role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin', index_number?: string) => Promise<void>;
  signIn: (emailOrIndex: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
    // Run database migrations on app start
    runMigrations();
  }, []);

  const loadUser = async () => {
    try {
      const token = auth.getToken();
      if (token) {
        const userData = await auth.verifyToken(token);
        if (userData) {
          setUser(userData);
        } else {
          auth.removeToken();
        }
      }
    } catch (error) {
      console.error('Error loading user:', error);
      auth.removeToken();
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string, role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin', index_number?: string) => {
    try {
      const response = await auth.signUp(email, password, name, role, index_number);
      auth.setToken(response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (emailOrIndex: string, password: string) => {
    try {
      const response = await auth.signIn(emailOrIndex, password);
      auth.setToken(response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    auth.removeToken();
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
