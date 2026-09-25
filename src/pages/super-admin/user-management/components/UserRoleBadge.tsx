import Badge from '../../../../components/ui/Badge';
import { UserRole } from '../types';

interface UserRoleBadgeProps {
  role: UserRole;
  className?: string;
}

export function getRoleBadgeVariant(role: UserRole): 'primary' | 'success' | 'danger' | 'warning' | 'secondary' {
  switch (role) {
    case 'super_admin':
      return 'primary';
    case 'admin':
      return 'secondary';
    case 'moderator':
      return 'warning';
    case 'lecturer':
      return 'success';
    case 'student':
      return 'secondary';
    default:
      return 'secondary';
  }
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Administrator';
    case 'moderator':
      return 'Moderator';
    case 'lecturer':
      return 'Lecturer';
    case 'student':
      return 'Student';
    default:
      return role;
  }
}

export default function UserRoleBadge({ role, className = '' }: UserRoleBadgeProps) {
  return (
    <Badge variant={getRoleBadgeVariant(role)} className={className}>
      {formatRoleLabel(role)}
    </Badge>
  );
}
