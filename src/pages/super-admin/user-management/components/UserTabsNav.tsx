import { Users, GraduationCap, BookOpen, ShieldCheck } from 'lucide-react';
import { UserTab, UserStats } from '../types';

interface UserTabsNavProps {
  activeTab: UserTab;
  onSelectTab: (tab: UserTab) => void;
  stats: UserStats;
}

export default function UserTabsNav({ activeTab, onSelectTab, stats }: UserTabsNavProps) {
  const tabs = [
    {
      id: 'all' as UserTab,
      label: 'All Users',
      icon: Users,
      count: stats.total,
    },
    {
      id: 'students' as UserTab,
      label: 'Students',
      icon: GraduationCap,
      count: stats.students,
    },
    {
      id: 'lecturers' as UserTab,
      label: 'Lecturers',
      icon: BookOpen,
      count: stats.lecturers,
    },
    {
      id: 'staff' as UserTab,
      label: 'Staff & Admins',
      icon: ShieldCheck,
      count: stats.staff,
    },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto" aria-label="User Sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`whitespace-nowrap py-3 px-3 sm:px-4 border-b-2 font-medium text-sm flex items-center gap-2 transition-all ${
                isActive
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
              <span>{tab.label}</span>
              <span
                className={`ml-1.5 py-0.5 px-2 rounded-full text-xs font-semibold ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
