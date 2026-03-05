import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Settings, HelpCircle } from 'lucide-react';

interface MenuItem {
  label: string;
  path: string;
  icon: ReactNode;
}

interface SidebarProps {
  menuItems: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ menuItems, isOpen, onClose }: SidebarProps) {
  const location = useLocation();

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-gray-900 to-gray-800 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } shadow-2xl`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">Q</span>
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">Quiz System</h2>
                <p className="text-gray-400 text-xs">Management Portal</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <motion.div
                  key={item.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Link
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={isActive ? 'text-white' : 'text-gray-400'}
                    >
                      {item.icon}
                    </motion.div>
                    <span className={`font-medium ${isActive ? 'text-white' : 'text-gray-300'}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute right-2 w-2 h-2 bg-white rounded-full"
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-700">
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-200">
                <Settings size={20} className="text-gray-400" />
                <span className="font-medium">Settings</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-200">
                <HelpCircle size={20} className="text-gray-400" />
                <span className="font-medium">Help & Support</span>
              </button>
              <div className="pt-2 mt-2 border-t border-gray-700">
                <div className="flex items-center gap-3 px-4 py-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-sm">U</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-white text-sm font-medium">User</div>
                    <div className="text-gray-400 text-xs">Administrator</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
