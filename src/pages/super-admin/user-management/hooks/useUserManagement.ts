import { useState, useEffect, useCallback } from 'react';
import { db } from '../../../../lib/database';
import { useAuth } from '../../../../contexts/AuthContext';
import { User, UserRole, UserTab, UserStats } from '../types';
import { canAssignRole, canDeleteUser } from '../utils/rolePolicy';
import type { CreateUserPayload } from '../components/CreateUserModal';

export function useUserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [superAdminCount, setSuperAdminCount] = useState(0);
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    students: 0,
    lecturers: 0,
    staff: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tabs and Filters
  const [activeTab, setActiveTab] = useState<UserTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editRole, setEditRole] = useState<UserRole>('student');

  // Feedback notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Debounce search query for server-side pagination
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const [pageData, roleStats] = await Promise.all([
        db.getUsersPaginated({
          page: currentPage,
          pageSize,
          tab: activeTab,
          role: roleFilter,
          search: debouncedSearch,
        }),
        db.getUserRoleStats(),
      ]);

      setUsers((pageData?.users as User[]) || []);
      setTotalItems(Number(pageData?.total || 0));

      setStats({
        total: Number(roleStats?.total || 0),
        students: Number(roleStats?.students || 0),
        lecturers: Number(roleStats?.lecturers || 0),
        staff: Number(roleStats?.staff || 0),
      });
      setSuperAdminCount(Number(roleStats?.super_admins || 0));
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to fetch users. Please try again.');
      showToast('Failed to load users from database', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, activeTab, roleFilter, debouncedSearch, showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Reset sub-role filter when changing tabs
  const handleTabChange = useCallback((tab: UserTab) => {
    setActiveTab(tab);
    setRoleFilter('all');
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleRoleFilterChange = useCallback((value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Modal open/close handlers
  const openEditModal = useCallback((user: User) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setSelectedUser(null);
  }, []);

  const openDeleteModal = useCallback((user: User) => {
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    setSelectedUser(null);
  }, []);

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  // CRUD actions (server enforces policy and writes audit_logs atomically)
  const handleUpdateRole = useCallback(async () => {
    if (!selectedUser) return;

    const policyCheck = canAssignRole(currentUser, selectedUser, editRole, superAdminCount);
    if (!policyCheck.allowed) {
      showToast(policyCheck.reason || 'You do not have permission to perform this role change.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await db.updateUserRole(selectedUser.id, editRole);
      await loadUsers();
      showToast(`Role updated for ${selectedUser.name} to ${editRole.replace('_', ' ').toUpperCase()}`, 'success');
      closeEditModal();
    } catch (err: any) {
      console.error('Error updating user role:', err);
      showToast(err?.message || 'Failed to update user role. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, editRole, currentUser, superAdminCount, loadUsers, showToast, closeEditModal]);

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUser) return;

    const policyCheck = canDeleteUser(currentUser, selectedUser);
    if (!policyCheck.allowed) {
      showToast(policyCheck.reason || 'You do not have permission to delete this user.', 'warning');
      return;
    }

    try {
      setIsSubmitting(true);
      await db.deleteUser(selectedUser.id);
      await loadUsers();
      showToast(`User ${selectedUser.name} has been removed.`, 'success');
      closeDeleteModal();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      showToast(err?.message || 'Failed to delete user. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, currentUser, loadUsers, showToast, closeDeleteModal]);

  const handleCreateUser = useCallback(async (payload: CreateUserPayload): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      await db.createUserByAdmin(payload);
      await loadUsers();
      showToast(`Created account for ${payload.name} (${payload.role.replace('_', ' ').toUpperCase()})`, 'success');
      closeCreateModal();
      return true;
    } catch (err: any) {
      console.error('Error creating user:', err);
      showToast(err?.message || 'Failed to create user. Please try again.', 'error');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadUsers, showToast, closeCreateModal]);

  return {
    users,
    currentUser,
    superAdminCount,
    filteredUsers: users,
    paginatedUsers: users,
    totalItems,
    currentPage,
    setCurrentPage: handlePageChange,
    pageSize,
    setPageSize: handlePageSizeChange,
    totalPages,
    loading,
    error,
    isSubmitting,
    stats,
    activeTab,
    setActiveTab: handleTabChange,
    searchTerm,
    setSearchTerm: handleSearchChange,
    roleFilter,
    setRoleFilter: handleRoleFilterChange,
    selectedUser,
    editRole,
    setEditRole,
    isEditModalOpen,
    isDeleteModalOpen,
    isCreateModalOpen,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    openCreateModal,
    closeCreateModal,
    handleUpdateRole,
    handleDeleteUser,
    handleCreateUser,
    loadUsers,
    toast,
    closeToast,
  };
}
