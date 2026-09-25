import { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '../../../../lib/database';
import { User, UserRole, UserTab, UserStats } from '../types';

export function useUserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tabs and Filters
  const [activeTab, setActiveTab] = useState<UserTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals state
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editRole, setEditRole] = useState<UserRole>('student');

  // Feedback notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  }, []);

  const closeToast = useCallback(() => {
    setToast(null);
  }, []);

  // Fetch all users
  const loadUsers = useCallback(async () => {
    try {
      setError(null);
      const allUsers = await db.getAllUsers();
      setUsers((allUsers as User[]) || []);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to fetch users. Please try again.');
      showToast('Failed to load users from database', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Reset sub-role filter when changing tabs
  const handleTabChange = useCallback((tab: UserTab) => {
    setActiveTab(tab);
    setRoleFilter('all');
  }, []);

  // Compute category stats
  const stats: UserStats = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.role === 'student') acc.students += 1;
        else if (user.role === 'lecturer') acc.lecturers += 1;
        else if (['moderator', 'admin', 'super_admin'].includes(user.role)) acc.staff += 1;
        return acc;
      },
      { total: 0, students: 0, lecturers: 0, staff: 0 }
    );
  }, [users]);

  // Filtered and searched users
  const filteredUsers = useMemo(() => {
    let result = users;

    // 1. Filter by Active Tab
    if (activeTab === 'students') {
      result = result.filter(user => user.role === 'student');
    } else if (activeTab === 'lecturers') {
      result = result.filter(user => user.role === 'lecturer');
    } else if (activeTab === 'staff') {
      result = result.filter(user => ['moderator', 'admin', 'super_admin'].includes(user.role));
    }

    // 2. Filter by specific role (e.g., when viewing All or narrowing down Staff)
    if (roleFilter !== 'all') {
      result = result.filter(user => user.role === roleFilter);
    }

    // 3. Search query filter
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter(user => {
        const nameMatch = user.name?.toLowerCase().includes(query);
        const emailMatch = user.email?.toLowerCase().includes(query);
        const indexMatch = user.index_number?.toLowerCase().includes(query);
        return Boolean(nameMatch || emailMatch || indexMatch);
      });
    }

    return result;
  }, [users, activeTab, roleFilter, searchTerm]);

  // Reset page to 1 when filters or tabs change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, roleFilter]);

  // Total items and pages
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Guard against currentPage exceeding totalPages
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Paginated subset of filtered users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  }, []);

  // Modal open handlers
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

  // CRUD actions
  const handleUpdateRole = useCallback(async () => {
    if (!selectedUser) return;

    try {
      setIsSubmitting(true);
      await db.updateUserRole(selectedUser.id, editRole);
      await loadUsers();
      showToast(`Role updated for ${selectedUser.name} to ${editRole.replace('_', ' ').toUpperCase()}`, 'success');
      closeEditModal();
    } catch (err) {
      console.error('Error updating user role:', err);
      showToast('Failed to update user role. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, editRole, loadUsers, showToast, closeEditModal]);

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUser) return;

    try {
      setIsSubmitting(true);
      await db.deleteUser(selectedUser.id);
      await loadUsers();
      showToast(`User ${selectedUser.name} has been removed.`, 'success');
      closeDeleteModal();
    } catch (err) {
      console.error('Error deleting user:', err);
      showToast('Failed to delete user. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedUser, loadUsers, showToast, closeDeleteModal]);

  return {
    users,
    filteredUsers,
    paginatedUsers,
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
    setSearchTerm,
    roleFilter,
    setRoleFilter,
    selectedUser,
    editRole,
    setEditRole,
    isEditModalOpen,
    isDeleteModalOpen,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    handleUpdateRole,
    handleDeleteUser,
    loadUsers,
    toast,
    closeToast,
  };
}
