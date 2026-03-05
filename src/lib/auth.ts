import { sha256 } from 'js-sha256';
import CryptoJS from 'crypto-js';
import { sql } from './database';

const JWT_SECRET = import.meta.env.VITE_JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'lecturer' | 'student';
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export const auth = {
  // Register new user
  async signUp(email: string, password: string, name: string, role: 'lecturer' | 'student'): Promise<AuthResponse> {
    // Check if user already exists
    const existingUsers = await sql`SELECT id FROM profiles WHERE email = ${email}`;
    if (existingUsers.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Hash password using SHA-256 (for demo - use bcrypt in production)
    const passwordHash = sha256(password + JWT_SECRET);

    // Create user
    const result = await sql`
      INSERT INTO profiles (email, password_hash, name, role)
      VALUES (${email}, ${passwordHash}, ${name}, ${role})
      RETURNING id, email, name, role, created_at
    `;

    const user = result[0] as User;
    const token = this.generateToken(user);

    return { user, token };
  },

  // Login user
  async signIn(email: string, password: string): Promise<AuthResponse> {
    // Find user by email
    const result = await sql`
      SELECT id, email, password_hash, name, role, created_at 
      FROM profiles 
      WHERE email = ${email}
    `;

    if (result.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userRecord = result[0];
    
    // Verify password
    const hashedPassword = sha256(password + JWT_SECRET);
    if (hashedPassword !== userRecord.password_hash) {
      throw new Error('Invalid email or password');
    }

    const user: User = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      created_at: userRecord.created_at
    };

    const token = this.generateToken(user);

    return { user, token };
  },

  // Generate simple token
  generateToken(user: User): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
    };

    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    
    const signature = CryptoJS.HmacSHA256(`${encodedHeader}.${encodedPayload}`, JWT_SECRET).toString();
    const encodedSignature = btoa(signature);

    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
  },

  // Verify JWT-like token
  async verifyToken(token: string): Promise<User | null> {
    try {
      const [header, payload, signature] = token.split('.');
      
      // Verify signature
      const expectedSignature = CryptoJS.HmacSHA256(`${header}.${payload}`, JWT_SECRET).toString();
      const decodedSignature = atob(signature);
      
      if (expectedSignature !== decodedSignature) {
        return null;
      }

      const decodedPayload = JSON.parse(atob(payload));
      
      // Check expiration
      if (decodedPayload.exp < Date.now()) {
        return null;
      }

      // Get user from database
      const result = await sql`
        SELECT id, email, name, role, created_at 
        FROM profiles 
        WHERE id = ${decodedPayload.userId}
      `;

      if (result.length === 0) {
        return null;
      }

      return result[0] as User;
    } catch (error) {
      return null;
    }
  },

  // Get current user from localStorage
  getCurrentUser(): User | null {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return null;

      const [header, payload] = token.split('.');
      const decodedPayload = JSON.parse(atob(payload));
      
      // Check expiration
      if (decodedPayload.exp < Date.now()) {
        return null;
      }

      return {
        id: decodedPayload.userId,
        email: decodedPayload.email,
        name: '', // Will be loaded from API
        role: decodedPayload.role,
        created_at: ''
      };
    } catch (error) {
      return null;
    }
  },

  // Store auth token
  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  },

  // Remove auth token
  removeToken(): void {
    localStorage.removeItem('auth_token');
  },

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
};
