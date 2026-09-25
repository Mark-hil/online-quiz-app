import { Edit2, Trash2, Calendar, Mail } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Pagination from '../../../../components/ui/Pagination';
import UserRoleBadge from './UserRoleBadge';
import UserEmptyState from './UserEmptyState';
import { User } from '../types';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
    onItemsPerPageChange: (size: number) => void;
  };
}

export default function UserTable({
  users,
  onEdit,
  onDelete,
  hasFilters,
  onClearFilters,
  pagination,
}: UserTableProps) {
  if (users.length === 0) {
    return (
      <Card className="border border-gray-200">
        <UserEmptyState
          hasFilters={hasFilters}
          onClearFilters={onClearFilters}
          message={hasFilters ? undefined : 'No users found in the system.'}
        />
      </Card>
    );
  }

  return (
    <Card className="border border-gray-200 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-200 text-left">
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                User
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                Index Number / ID
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                Role
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  Created At
                </span>
              </th>
              <th className="py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-gray-600 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {users.map((user) => {
              const initials = user.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase()
                : 'U';

              return (
                <tr key={user.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-800 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} className="text-gray-400" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {user.index_number ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-800 font-mono text-xs border border-gray-200">
                        {user.index_number}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <UserRoleBadge role={user.role} />
                  </td>
                  <td className="py-3.5 px-4 text-sm text-gray-600 whitespace-nowrap">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(user)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                        title="Edit User Role"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onDelete(user)}
                        className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
