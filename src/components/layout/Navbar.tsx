import { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, Bell, LogOut, User, Settings, HelpCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';

interface NavbarProps {
  onMenuClick: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const { user, signOut } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <nav className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 px-4 py-3 shadow-lg sticky top-0 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={onMenuClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="lg:hidden text-gray-600 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50"
          >
            <Menu size={24} />
          </motion.button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">Q</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Quiz System
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="hidden md:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search quizzes, students..."
                className="w-64 px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Notifications */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative text-gray-600 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50"
          >
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
              3
            </span>
          </motion.button>

          {/* User Profile */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 text-gray-700 hover:text-blue-600 transition-colors p-2 rounded-lg hover:bg-blue-50"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <User size={16} className="text-white" />
              </div>
              <div className="hidden md:block text-left">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
              </div>
            </motion.button>

            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
              >
                <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <User size={16} />
                  Profile
                </button>
                <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <Settings size={16} />
                  Settings
                </button>
                <button className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-3">
                  <HelpCircle size={16} />
                  Help
                </button>
                <hr className="my-2 border-gray-100" />
                <button
                  onClick={signOut}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-3"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
