import { api } from './apiClient';

export interface User {
  id: string;
  email: string;
  name: string;
  index_number?: string;
  role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin';
  created_at: string;
}

export const PUBLIC_SIGNUP_ROLES = ['student', 'lecturer'] as const;
export type PublicSignupRole = typeof PUBLIC_SIGNUP_ROLES[number];

export interface AuthResponse {
  user: User;
  token?: string;
}

let cachedUser: User | null = null;

// Synchronously restore cached user for fast UI render if available
try {
  const stored = sessionStorage.getItem('qa_user_cache');
  if (stored) {
    cachedUser = JSON.parse(stored);
  }
} catch {
  // Ignore parsing errors
}

export const auth = {
  // Check if system is in initial bootstrap mode (0 super admins exist)
  async isBootstrapAvailable(): Promise<boolean> {
    try {
      const res = await api.get<{ available: boolean }>('/api/auth/bootstrap');
      return !!res?.available;
    } catch (error) {
      console.error('Error checking super admin bootstrap availability:', error);
      return false;
    }
  },

  // Register new user
  async signUp(
    email: string,
    password: string,
    name: string,
    role: 'lecturer' | 'student' | 'moderator' | 'admin' | 'super_admin',
    index_number?: string
  ): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/auth/signup', {
      email,
      password,
      name,
      role,
      index_number,
    });

    cachedUser = res.user;
    try {
      sessionStorage.setItem('qa_user_cache', JSON.stringify(res.user));
    } catch {}

    return res;
  },

  // Login user
  async signIn(emailOrIndex: string, password: string): Promise<AuthResponse> {
    const res = await api.post<AuthResponse>('/api/auth/login', {
      identifier: emailOrIndex,
      password,
    });

    cachedUser = res.user;
    try {
      sessionStorage.setItem('qa_user_cache', JSON.stringify(res.user));
    } catch {}

    return res;
  },

  // Log out
  async signOut(): Promise<void> {
    try {
      await api.post('/api/auth/logout');
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      cachedUser = null;
      try {
        sessionStorage.removeItem('qa_user_cache');
        localStorage.removeItem('auth_token');
      } catch {}
    }
  },

  // Fetch current session from server (verifies httpOnly cookie)
  async me(): Promise<User | null> {
    try {
      const res = await api.get<{ user: User }>('/api/auth/me', { skipAuthRedirect: true });
      cachedUser = res.user;
      try {
        sessionStorage.setItem('qa_user_cache', JSON.stringify(res.user));
      } catch {}
      return res.user;
    } catch {
      cachedUser = null;
      try {
        sessionStorage.removeItem('qa_user_cache');
      } catch {}
      return null;
    }
  },

  // Backwards compatibility for verifyToken
  async verifyToken(_token?: string): Promise<User | null> {
    return this.me();
  },

  // Get current user (cached for synchronous calls)
  getCurrentUser(): User | null {
    return cachedUser;
  },

  // Compatibility wrappers for existing code
  setToken(_token: string): void {
    // Cookie is set automatically via Set-Cookie header by server
  },

  removeToken(): void {
    cachedUser = null;
    try {
      sessionStorage.removeItem('qa_user_cache');
      localStorage.removeItem('auth_token');
    } catch {}
  },

  getToken(): string | null {
    // Session token is stored in HttpOnly cookie
    return null;
  },
};
