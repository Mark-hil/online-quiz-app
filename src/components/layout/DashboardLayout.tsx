import { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
  menuItems: Array<{
    label: string;
    path: string;
    icon: ReactNode;
  }>;
}

export default function DashboardLayout({ children, menuItems }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse"></div>
      </div>

      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex relative">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out`}>
          <Sidebar
            menuItems={menuItems}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        <motion.main 
          className="flex-1 p-6 lg:ml-64 min-h-screen"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="max-w-7xl mx-auto">
            {/* Page Header with Gradient Background */}
            <div className="mb-8 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">Quiz Management System</h1>
                  <p className="text-blue-100 text-lg">Welcome back! Here's what's happening with your quizzes today.</p>
                </div>
                <div className="hidden md:block">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                    <div className="text-2xl font-bold">{new Date().toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    <div className="text-sm">{new Date().toLocaleDateString()}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20">
              {children}
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
