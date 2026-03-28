import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Plus,
  BookOpen,
  ClipboardList,
  FileText,
  BarChart3,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  Users,
  Settings,
} from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import Loading from './components/ui/Loading';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import LecturerDashboard from './pages/lecturer/Dashboard';
import CreateQuiz from './pages/lecturer/CreateQuiz';
import QuestionBank from './pages/lecturer/QuestionBank';
import MyQuizzes from './pages/lecturer/MyQuizzes';
import Submissions from './pages/lecturer/Submissions';
import SubmissionDetail from './pages/lecturer/SubmissionDetail';
import Analytics from './pages/lecturer/Analytics';

import StudentDashboard from './pages/student/Dashboard';
import AvailableQuizzes from './pages/student/AvailableQuizzes';
import TakeQuiz from './pages/student/TakeQuiz';
import MyAttempts from './pages/student/MyAttempts';
import Results from './pages/student/Results';

import ModeratorDashboard from './pages/moderator/Dashboard';
import PendingQuizzes from './pages/moderator/PendingQuizzes';
import RecentlyApproved from './pages/moderator/RecentlyApproved';
import AdminDashboard from './pages/admin/Dashboard';
import ApprovedQuizzes from './pages/admin/ApprovedQuizzes';
import PublishedQuizzes from './pages/admin/PublishedQuizzes';

const lecturerMenuItems = [
  { label: 'Dashboard', path: '/lecturer/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Create Quiz', path: '/lecturer/create-quiz', icon: <Plus size={20} /> },
  { label: 'Question Bank', path: '/lecturer/question-bank', icon: <BookOpen size={20} /> },
  { label: 'My Quizzes', path: '/lecturer/my-quizzes', icon: <ClipboardList size={20} /> },
  { label: 'Submissions', path: '/lecturer/submissions', icon: <FileText size={20} /> },
  { label: 'Analytics', path: '/lecturer/analytics', icon: <BarChart3 size={20} /> },
];

const studentMenuItems = [
  { label: 'Dashboard', path: '/student/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Available Quizzes', path: '/student/quizzes', icon: <BookOpen size={20} /> },
  { label: 'My Attempts', path: '/student/attempts', icon: <Clock size={20} /> },
];

const moderatorMenuItems = [
  { label: 'Dashboard', path: '/moderator/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Pending Quizzes', path: '/moderator/pending-quizzes', icon: <AlertCircle size={20} /> },
  { label: 'Recently Approved', path: '/moderator/recently-approved', icon: <CheckCircle size={20} /> },
];

const adminMenuItems = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Approved Quizzes', path: '/admin/approved-quizzes', icon: <CheckCircle size={20} /> },
  { label: 'Published Quizzes', path: '/admin/published-quizzes', icon: <BookOpen size={20} /> },
];

function DashboardRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'lecturer') {
    return <Navigate to="/lecturer/dashboard" replace />;
  } else if (user.role === 'student') {
    return <Navigate to="/student/dashboard" replace />;
  } else if (user.role === 'moderator') {
    return <Navigate to="/moderator/dashboard" replace />;
  } else if (user.role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/dashboard" element={<DashboardRouter />} />

        <Route
          path="/lecturer/*"
          element={
            <ProtectedRoute requiredRole="lecturer">
              <DashboardLayout menuItems={lecturerMenuItems}>
                <Routes>
                  <Route path="dashboard" element={<LecturerDashboard />} />
                  <Route path="create-quiz" element={<CreateQuiz />} />
                  <Route path="edit-quiz/:id" element={<CreateQuiz />} />
                  <Route path="question-bank" element={<QuestionBank />} />
                  <Route path="my-quizzes" element={<MyQuizzes />} />
                  <Route path="submissions" element={<Submissions />} />
                  <Route path="submission/:id" element={<SubmissionDetail />} />
                  <Route path="analytics" element={<Analytics />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/*"
          element={
            <ProtectedRoute requiredRole="student">
              <DashboardLayout menuItems={studentMenuItems}>
                <Routes>
                  <Route path="dashboard" element={<StudentDashboard />} />
                  <Route path="quizzes" element={<AvailableQuizzes />} />
                  <Route path="quiz/:id" element={<TakeQuiz />} />
                  <Route path="attempts" element={<MyAttempts />} />
                  <Route path="result/:id" element={<Results />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/moderator/*"
          element={
            <ProtectedRoute requiredRole="moderator">
              <DashboardLayout menuItems={moderatorMenuItems}>
                <Routes>
                  <Route path="dashboard" element={<ModeratorDashboard />} />
                  <Route path="pending-quizzes" element={<PendingQuizzes />} />
                  <Route path="recently-approved" element={<RecentlyApproved />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin">
              <DashboardLayout menuItems={adminMenuItems}>
                <Routes>
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="approved-quizzes" element={<ApprovedQuizzes />} />
                  <Route path="published-quizzes" element={<PublishedQuizzes />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
