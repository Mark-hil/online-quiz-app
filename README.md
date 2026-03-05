# Quiz Management System

A complete web application for managing quizzes with separate interfaces for lecturers and students. Built with React, TypeScript, Tailwind CSS, and Supabase.

## Features

### For Lecturers
- Create and manage quizzes with multiple question types (MCQ, True/False, Essay)
- Question bank management
- View and grade student submissions
- Analytics dashboard with performance metrics
- Publish/unpublish quizzes
- Auto-grading for MCQ and True/False questions
- Manual grading with comments for essay questions

### For Students
- Browse and take available quizzes
- Real-time timer during quiz attempts
- Question navigation with mark for review
- View quiz results with detailed feedback
- Track all quiz attempts and scores
- Performance analytics

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- A Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd quiz-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

You can find these values in your Supabase project settings under API.

### Database Setup

The database schema has already been applied through migrations. The following tables were created:

- `profiles` - User profiles with role information
- `quizzes` - Quiz information
- `questions` - Quiz questions
- `quiz_attempts` - Student quiz attempts
- `student_answers` - Student answers to questions

All tables have Row Level Security (RLS) enabled for data protection.

### Running the Application

Development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Usage

### First Time Setup

1. Navigate to `/signup` to create an account
2. Choose your role (Lecturer or Student)
3. Complete the registration form
4. Login with your credentials

### Lecturer Workflow

1. **Create a Quiz**
   - Go to "Create Quiz" from the sidebar
   - Fill in quiz details (title, description, subject, duration)
   - Add questions using the question builder
   - Choose question types: MCQ, True/False, or Essay
   - Publish the quiz when ready

2. **Manage Questions**
   - View all questions in the Question Bank
   - Edit or delete questions
   - Filter by question type

3. **Review Submissions**
   - Go to "Submissions" to see all student attempts
   - Click on a submission to view details
   - Grade essay questions manually
   - Add comments and feedback

4. **View Analytics**
   - Track overall performance metrics
   - See average scores and pass rates
   - Monitor student engagement

### Student Workflow

1. **Take a Quiz**
   - Browse available quizzes
   - Click "Start Quiz" to begin
   - Answer questions within the time limit
   - Navigate between questions using Previous/Next or the question palette
   - Mark questions for review if needed
   - Submit when complete

2. **View Results**
   - Go to "My Attempts" to see all quiz attempts
   - Click on a graded attempt to view detailed results
   - Review correct/incorrect answers
   - Read lecturer comments on essay questions

## Project Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Navbar, Sidebar, DashboardLayout)
│   ├── ui/              # Reusable UI components
│   └── ProtectedRoute.tsx
├── contexts/
│   └── AuthContext.tsx  # Authentication context
├── lib/
│   └── supabase.ts      # Supabase client and types
├── pages/
│   ├── auth/            # Login and Signup pages
│   ├── lecturer/        # Lecturer pages
│   └── student/         # Student pages
├── App.tsx              # Main app with routing
├── main.tsx            # App entry point
└── index.css           # Global styles
```

## Key Features Explained

### Authentication
- Email/password authentication using Supabase Auth
- Role-based access control (Lecturer/Student)
- Protected routes based on user role
- Automatic profile creation on signup

### Quiz Creation
- Support for multiple question types
- Dynamic option fields for MCQ questions
- Correct answer selection
- Marks per question configuration
- Draft and publish functionality

### Quiz Taking
- Countdown timer with auto-submit
- Question navigation palette
- Mark questions for review
- Auto-save answers
- Visual indicators for answered/unanswered questions

### Grading System
- Automatic grading for MCQ and True/False
- Manual grading interface for essay questions
- Marks allocation per question
- Lecturer comments and feedback
- Score calculation as percentage

### Security
- Row Level Security (RLS) on all tables
- Students can only access their own data
- Lecturers can only manage their own quizzes
- Authentication required for all protected routes

## Design Features

- Clean, modern interface with Tailwind CSS
- Responsive design (mobile, tablet, desktop)
- Color-coded status badges
- Hover effects and transitions
- Loading states and empty states
- Modal dialogs for confirmations
- Toast notifications (component included)

## Future Enhancements

Potential features to add:
- Bulk question import (CSV/Excel)
- Question randomization
- Quiz scheduling with deadlines
- Multiple attempts per quiz
- Quiz categories and tags
- Advanced analytics with charts
- Export results to PDF/Excel
- Email notifications
- Real-time quiz taking with leaderboards

## License

MIT License - feel free to use this project for your own purposes.
