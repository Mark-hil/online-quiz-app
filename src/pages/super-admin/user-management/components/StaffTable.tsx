import { Edit2, Trash2, Shield, Calendar, Mail, Lock } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Pagination from '../../../../components/ui/Pagination';
import UserRoleBadge from './UserRoleBadge';
import UserEmptyState from './UserEmptyState';
import { User, UserRole } from '../types';
import { canEditUserRole } from '../utils/rolePolicy';

interface StaffTableProps {
  staffMembers: User[];
  currentUserId?: string;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  title?: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
    onItemsPerPageChange: (size: number) => void;
  };
}

export default function StaffTable({
  staffMembers,
  currentUserId,
  onEdit,
  onDelete,
  hasFilters,
  onClearFilters,
  title,
  pagination,
}: StaffTableProps) {
  if (staffMembers.length === 0) {
    return (
      <Card className="border border-gray-200">
        <UserEmptyState
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
          message={hasFilters ? undefined : `No ${title ? title.toLowerCase() : 'staff or academic personnel'} found in this category.`}
        />
      </Card>
    );
  }

  const getRoleResponsibilities = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'Full System Access & Governance';
      case 'admin':
        return 'User & Course Management';
      case 'moderator':
        return 'Quiz Approval & Review';
      case 'lecturer':
        return 'Quiz Creation & Question Bank';
      default:
        return 'Standard User';
    }
  };

  const getAvatarBg = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return 'bg-blue-100 text-blue-800';
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'moderator':
        return 'bg-amber-100 text-amber-800';
      case 'lecturer':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border border-gray-200 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-left">
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                Staff Member
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                System Role
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Shield size={14} className="text-gray-400" />
                  Primary Scope
                </span>
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  Joined Date
                </span>
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {staffMembers.map((member) => {
              const initials = member.name
                ? member.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'ST';

              const isSuperAdmin = member.role === 'super_admin';

              return (
                <tr key={member.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full font-semibold text-xs flex items-center justify-center flex-shrink-0 ${getAvatarBg(
                          member.role
                        )}`}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {member.name}
                          {member.id === currentUserId && (
                            <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[10px] rounded font-semibold border border-gray-200">
                              YOU
                            </span>
                          )}
                          {isSuperAdmin && (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded font-semibold border border-blue-200">
                              ROOT
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} className="text-gray-400" />
                          {member.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <UserRoleBadge role={member.role} />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                      {getRoleResponsibilities(member.role)}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-sm text-gray-600 whitespace-nowrap">
                    {member.created_at ? new Date(member.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {(() => {
                      const editPolicy = canEditUserRole(
                        currentUserId ? { id: currentUserId, role: 'super_admin' } : null,
                        member
                      );
                      if (!editPolicy.allowed) {
                        return (
                          <div className="flex items-center justify-end">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border cursor-default ${
                                editPolicy.badgeType === 'protected'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-100 text-gray-600 border-gray-200'
                              }`}
                              title={editPolicy.reason}
                            >
                              <Lock size={12} className={editPolicy.badgeType === 'protected' ? 'text-blue-500' : 'text-gray-400'} />
                              {editPolicy.badgeType === 'protected' ? 'Protected' : 'Current User'}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onEdit(member)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                            title="Change Role"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => onDelete(member)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalItems > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.onPageChange}
          totalItems={pagination.totalItems}
          itemsPerPage={pagination.itemsPerPage}
          onItemsPerPageChange={pagination.onItemsPerPageChange}
        />
      )}
    </Card>
  );
}
