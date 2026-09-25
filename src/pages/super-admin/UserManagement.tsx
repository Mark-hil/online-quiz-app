import Badge from '../../components/ui/Badge';
import Toast from '../../components/ui/Toast';
import { useUserManagement } from './user-management/hooks/useUserManagement';
import UserStatsCards from './user-management/components/UserStatsCards';
import UserTabsNav from './user-management/components/UserTabsNav';
import UserFilters from './user-management/components/UserFilters';
import StudentTable from './user-management/components/StudentTable';
import StaffTable from './user-management/components/StaffTable';
import UserTable from './user-management/components/UserTable';
import EditUserRoleModal from './user-management/components/EditUserRoleModal';
import DeleteUserModal from './user-management/components/DeleteUserModal';

export default function UserManagement() {
  const {
    filteredUsers,
    paginatedUsers,
    totalItems,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    totalPages,
    loading,
    error,
    isSubmitting,
    stats,
    activeTab,
    setActiveTab,
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
    toast,
    closeToast,
  } = useUserManagement();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-gray-500">Loading user directory...</p>
      </div>
    );
  }

  const hasFilters = Boolean(searchTerm.trim() || roleFilter !== 'all');
  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
          duration={3500}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">User Management</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Oversee, filter, and manage students, faculty instructors, and administrative roles.
          </p>
        </div>
        <div>
          <Badge variant="primary">Super Admin Workspace</Badge>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <UserStatsCards
        stats={stats}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Tabs Navigation */}
      <UserTabsNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        stats={stats}
      />

      {/* Filters & Search */}
      <UserFilters
        activeTab={activeTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        totalFiltered={filteredUsers.length}
      />

      {/* Separated Content Views */}
      <div className="mt-4">
        {activeTab === 'students' && (
          <StudentTable
            students={paginatedUsers}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage,
              totalItems,
              itemsPerPage: pageSize,
              onItemsPerPageChange: setPageSize,
            }}
          />
        )}

        {activeTab === 'lecturers' && (
          <StaffTable
            staffMembers={paginatedUsers}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            title="Lecturers"
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage,
              totalItems,
              itemsPerPage: pageSize,
              onItemsPerPageChange: setPageSize,
            }}
          />
        )}

        {activeTab === 'staff' && (
          <StaffTable
            staffMembers={paginatedUsers}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            title="Administrative Staff"
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage,
              totalItems,
              itemsPerPage: pageSize,
              onItemsPerPageChange: setPageSize,
            }}
          />
        )}

        {activeTab === 'all' && (
          <UserTable
            users={paginatedUsers}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            pagination={{
              currentPage,
              totalPages,
              onPageChange: setCurrentPage,
              totalItems,
              itemsPerPage: pageSize,
              onItemsPerPageChange: setPageSize,
            }}
          />
        )}
      </div>

      {/* Modals */}
      <EditUserRoleModal
        isOpen={isEditModalOpen}
        user={selectedUser}
        selectedRole={editRole}
        onChangeRole={setEditRole}
        onConfirm={handleUpdateRole}
        onClose={closeEditModal}
        isSubmitting={isSubmitting}
      />

      <DeleteUserModal
        isOpen={isDeleteModalOpen}
        user={selectedUser}
        onConfirm={handleDeleteUser}
        onClose={closeDeleteModal}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
