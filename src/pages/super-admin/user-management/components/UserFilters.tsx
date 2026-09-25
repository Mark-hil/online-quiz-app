import { Search, X, Filter } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import Input from '../../../../components/ui/Input';
import Select from '../../../../components/ui/Select';
import { UserTab } from '../types';

interface UserFiltersProps {
  activeTab: UserTab;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  totalFiltered: number;
}

export default function UserFilters({
  activeTab,
  searchTerm,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  totalFiltered,
}: UserFiltersProps) {
  const getRoleOptions = () => {
    if (activeTab === 'staff') {
      return [
        { value: 'all', label: 'All Staff Roles' },
        { value: 'moderator', label: 'Moderators' },
        { value: 'admin', label: 'Admins' },
        { value: 'super_admin', label: 'Super Admins' },
      ];
    }

    return [
      { value: 'all', label: 'All Roles' },
      { value: 'student', label: 'Students' },
      { value: 'lecturer', label: 'Lecturers' },
      { value: 'moderator', label: 'Moderators' },
      { value: 'admin', label: 'Admins' },
      { value: 'super_admin', label: 'Super Admins' },
    ];
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case 'students':
        return 'Search students by name, email, or index number...';
      case 'lecturers':
        return 'Search lecturers by name or email...';
      case 'staff':
        return 'Search staff & administrators by name or email...';
      default:
        return 'Search all users by name, email, or index number...';
    }
  };

  const showRoleSelect = activeTab === 'all' || activeTab === 'staff';

  return (
    <Card className="p-4 border border-gray-200">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            placeholder={getPlaceholder()}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {showRoleSelect && (
          <div className="w-full md:w-56 flex items-center gap-2">
            <Filter size={16} className="text-gray-400 hidden sm:block flex-shrink-0" />
            <Select
              value={roleFilter}
              onChange={(e) => onRoleFilterChange(e.target.value)}
              options={getRoleOptions()}
            />
          </div>
        )}

        <div className="text-xs text-gray-500 font-medium self-end md:self-center whitespace-nowrap">
          Showing <span className="font-semibold text-gray-800">{totalFiltered}</span> user{totalFiltered !== 1 ? 's' : ''}
        </div>
      </div>
    </Card>
  );
}
