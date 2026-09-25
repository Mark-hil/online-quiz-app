import { Search, UserX } from 'lucide-react';
import Button from '../../../../components/ui/Button';

interface UserEmptyStateProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
  message?: string;
}

export default function UserEmptyState({
  hasFilters,
  onClearFilters,
  message,
}: UserEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-4">
        {hasFilters ? <Search size={28} /> : <UserX size={28} />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">
        {hasFilters ? 'No matching users found' : 'No users in this category'}
      </h3>
      <p className="text-sm text-gray-500 max-w-sm mb-4">
        {message ||
          (hasFilters
            ? 'Try adjusting your search keywords or filter settings to find what you are looking for.'
            : 'No users have registered or been assigned to this section yet.')}
      </p>
      {hasFilters && onClearFilters && (
        <Button variant="secondary" size="sm" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}
