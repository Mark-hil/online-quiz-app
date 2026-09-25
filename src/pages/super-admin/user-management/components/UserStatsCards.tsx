import { Users, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import Card from '../../../../components/ui/Card';
import { UserStats, UserTab } from '../types';

interface UserStatsCardsProps {
  stats: UserStats;
  activeTab: UserTab;
  onSelectTab: (tab: UserTab) => void;
}

export default function UserStatsCards({ stats, activeTab, onSelectTab }: UserStatsCardsProps) {
  const cards = [
    {
      tab: 'all' as UserTab,
      label: 'All Users',
      count: stats.total,
      description: 'System-wide registered accounts',
      icon: Users,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/20',
    },
    {
      tab: 'students' as UserTab,
      label: 'Students',
      count: stats.students,
      description: 'Learners taking assessments',
      icon: GraduationCap,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/20',
    },
    {
      tab: 'lecturers' as UserTab,
      label: 'Lecturers',
      count: stats.lecturers,
      description: 'Course creators & instructors',
      icon: BookOpen,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/20',
    },
    {
      tab: 'staff' as UserTab,
      label: 'Staff & Admins',
      count: stats.staff,
      description: 'Moderators, Admins & Super Admins',
      icon: ShieldCheck,
      iconColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = activeTab === c.tab;
        return (
          <Card
            key={c.tab}
            hover
            onClick={() => onSelectTab(c.tab)}
            className={`border transition-all duration-150 cursor-pointer ${
              isActive ? `${c.activeBorder} shadow-sm` : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{c.count.toLocaleString()}</p>
              </div>
              <div className={`p-3 rounded-xl ${c.bgColor}`}>
                <Icon size={22} className={c.iconColor} />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3 truncate">{c.description}</p>
          </Card>
        );
      })}
    </div>
  );
}
