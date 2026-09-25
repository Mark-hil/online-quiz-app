export type UserRole = 'student' | 'lecturer' | 'moderator' | 'admin' | 'super_admin';

export interface User {
  id: string;
  name: string;
  email: string;
  index_number?: string;
  role: UserRole;
  created_at: string;
}

export type UserTab = 'all' | 'students' | 'lecturers' | 'staff';

export interface UserStats {
  total: number;
  students: number;
  lecturers: number;
  staff: number;
}

export interface UserFiltersState {
  searchTerm: string;
  roleFilter: string;
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}
