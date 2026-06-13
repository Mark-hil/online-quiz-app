# Smart Online Examination System

A comprehensive web application for managing quizzes with role-based access control for lecturers, students, moderators, administrators, and super administrators. Built with React, TypeScript, Tailwind CSS, and Neon PostgreSQL.

## Features

### For Lecturers
- Create and manage quizzes with multiple question types (MCQ, True/False, Essay)
- Question bank management with CSV import support
- View and grade student submissions
- Analytics dashboard with performance metrics
- Publish/unpublish quizzes with scheduling
- Auto-grading for MCQ and True/False questions
- Manual grading with comments for essay questions
- Anti-cheating features (tab switch detection, time tracking)

### For Students
- Browse and take available quizzes
- Real-time timer during quiz attempts
- Question navigation with mark for review
- View quiz results with detailed feedback
- Track all quiz attempts and scores
- Performance analytics
- Secure exam environment with monitoring

### For Moderators
- Review and approve quiz questions
- Quality control for quiz content
- Ensure syllabus coverage
- Verify marking schemes
- Track recently approved content

### For Administrators
- Manage approved quizzes
- Publish quizzes to students
- Schedule exam sessions
- Monitor quiz statistics
- View published quiz analytics

### For Super Administrators
- **User Management**: Create, edit, and manage all user accounts and roles
- **Audit & Security**: Comprehensive logging of user activities, login attempts, and system access
- **System Maintenance**: Database backups, health monitoring, performance metrics, and error tracking
- **System Configuration**: Exams Settings, anti-cheating policies, role permissions, email configuration
- **Analytics & Reporting**: Usage reports, data export, quiz performance analytics, system utilization
- **Integration Management**: Configure third-party services, API keys, authentication providers, external services
- **Quiz Time Extension**: Handle network issues by extending quiz time without creating new quizzes

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Routing**: React Router v6
- **Icons**: Lucide React
- **Backend**: Neon PostgreSQL with @neondatabase/serverless
- **Authentication**: Custom JWT-based authentication
- **Database**: PostgreSQL with comprehensive schema for quizzes, users, and system management

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- A Neon PostgreSQL account and project

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

Create a `.env` file in the root directory with your Neon database credentials and other settings:

```env
# Neon Database
VITE_NEON_DATABASE_URL=postgresql://username:password@your-neon-project-url/dbname?sslmode=require

# JWT Secret for authentication
VITE_JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Google OAuth 2.0 (Optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret
VITE_GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Email Service (SMTP) (Optional)
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_SMTP_USERNAME=your-email@gmail.com
VITE_SMTP_PASSWORD=your-smtp-password
VITE_SMTP_FROM=noreply@quizsystem.com
VITE_SMTP_SECURE=true

# S3 Storage (Optional)
VITE_S3_BUCKET_NAME=your-bucket-name
VITE_S3_AWS_REGION=us-east-1
VITE_S3_ACCESS_KEY_ID=your-access-key-id
VITE_S3_SECRET_ACCESS_KEY=your-secret-access-key
```

You can find the Neon database URL in your Neon project dashboard.

### Database Setup

The database schema is automatically created when the application starts. The following tables are created:

- `profiles` - User profiles with role information (student, lecturer, moderator, admin, super_admin)
- `quizzes` - Quiz information with status and settings
- `questions` - Quiz questions with multiple types (MCQ, True/False, Essay)
- `quiz_attempts` - Student quiz attempts with time tracking and extension support
- `student_answers` - Student answers to questions
- `audit_logs` - Comprehensive audit trail of all user activities
- `login_attempts` - Login attempt tracking for security monitoring
- `system_settings` - System-wide configuration and settings
- `system_health` - System health metrics and monitoring
- `extension_requests` - Quiz time extension requests and approvals

All tables include proper indexing and constraints for optimal performance and data integrity.

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
2. Choose your role (Student, Lecturer, Moderator, Admin, or Super Admin)
3. Complete the registration form
4. Login with your credentials

### Role-Based Workflows

#### Super Admin Workflow
1. **System Management**: Access comprehensive admin dashboard
2. **User Management**: Create and manage all user accounts and roles
3. **Security Monitoring**: Review audit logs and login attempts
4. **System Configuration**: Configure Exams Settings, anti-cheating policies
5. **Maintenance**: Monitor system health and manage backups
6. **Integrations**: Configure third-party services and API keys
7. **Time Extensions**: Handle network issues by extending quiz time

#### Lecturer Workflow

1. **Create a Quiz**
   - Go to "Create Exams" from the sidebar
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

#### Student Workflow

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

#### Moderator Workflow

1. **Review Questions**
   - Access pending quiz questions from lecturers
   - Review content for accuracy and appropriateness
   - Approve or reject questions with feedback
   - Track recently approved content

2. **Quality Control**
   - Ensure questions meet syllabus requirements
   - Verify marking schemes are fair
   - Maintain question bank quality

#### Administrator Workflow

1. **Quiz Management**
   - Review approved quizzes from moderators
   - Publish quizzes to make them available to students
   - Schedule exam sessions and manage timelines
   - Monitor quiz statistics and performance

2. **System Oversight**
   - View published quiz analytics
   - Manage quiz availability
   - Coordinate with moderators and lecturers

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
│   ├── database.ts      # Database client and schema
│   └── auth.ts          # Authentication utilities
├── pages/
│   ├── auth/            # Login and Signup pages
│   ├── lecturer/        # Lecturer pages
│   ├── student/         # Student pages
│   ├── moderator/       # Moderator pages
│   ├── admin/           # Administrator pages
│   └── super-admin/     # Super Admin pages
│       ├── Dashboard.tsx
│       ├── UserManagement.tsx
│       ├── AuditLogs.tsx
│       ├── SystemMaintenance.tsx
│       ├── SystemConfiguration.tsx
│       ├── AnalyticsReporting.tsx
│       ├── IntegrationManagement.tsx
│       └── QuizTimeExtension.tsx
├── App.tsx              # Main app with routing
├── main.tsx            # App entry point
└── index.css           # Global styles
```

## Key Features Explained

### Authentication
- Custom JWT-based authentication system
- Multi-role access control (Student, Lecturer, Moderator, Admin, Super Admin)
- Protected routes based on user role
- Comprehensive audit logging
- Login attempt tracking and security monitoring

### Quiz Creation
- Support for multiple question types (MCQ, True/False, Essay)
- Dynamic option fields for MCQ questions
- Correct answer selection
- Marks per question configuration
- Draft and publish functionality
- CSV import support for bulk questions
- Anti-cheating settings and monitoring

### Quiz Taking
- Countdown timer with auto-submit
- Question navigation palette
- Mark questions for review
- Auto-save answers
- Visual indicators for answered/unanswered questions
- Real-time activity tracking
- Network issue detection and time extension support

### Grading System
- Automatic grading for MCQ and True/False
- Manual grading interface for essay questions
- Marks allocation per question
- Lecturer comments and feedback
- Score calculation as percentage
- Grade review and moderation workflow

### Security & Monitoring
- Comprehensive audit logs for all user activities
- Login attempt tracking with failure monitoring
- System health monitoring and performance metrics
- Role-based permissions and access control
- Suspicious activity detection

### System Administration
- User management with role assignment
- System configuration and settings management
- Database backup and maintenance tools
- Integration management for third-party services
- Analytics and reporting with data export
- Quiz time extension for network issues

## Design Features

- Clean, modern interface with Tailwind CSS
- Responsive design (mobile, tablet, desktop)
- Color-coded status badges
- Hover effects and transitions
- Loading states and empty states
- Modal dialogs for confirmations
- Toast notifications (component included)

## Advanced Features

### Super Admin Capabilities
- **Comprehensive Dashboard**: System overview with user statistics, quiz metrics, and health monitoring
- **User Management**: Create, edit, delete users with role assignment and permission management
- **Audit & Security**: Complete audit trail of all system activities with login monitoring and suspicious activity detection
- **System Maintenance**: Database backup management, performance monitoring, and system health tracking
- **Configuration Management**: System-wide settings for quizzes, anti-cheating policies, and role permissions
- **Analytics & Reporting**: Detailed usage reports, data export capabilities, and performance analytics
- **Integration Management**: Configure OAuth providers, email services, storage solutions, and API keys
- **Time Extension System**: Handle network disruptions by extending quiz time without recreating quizzes

### Security Features
- **Multi-factor Authentication**: Support for Google OAuth, GitHub OAuth, and traditional email/password
- **Activity Monitoring**: Real-time tracking of user actions with comprehensive logging
- **Anti-Cheating Measures**: Tab switch detection, time tracking, IP logging, and activity monitoring
- **Role-Based Access Control**: Granular permissions for different user roles
- **Audit Trail**: Complete logging of all system activities for compliance and security

### Performance & Scalability
- **Optimized Database Queries**: Efficient indexing and query optimization for large datasets
- **Real-time Updates**: Live monitoring of quiz attempts and system metrics
- **Bulk Operations**: Mass user management, quiz operations, and data export
- **Caching Strategy**: Performance optimization for frequently accessed data

## Future Enhancements

Potential features to add:
- Advanced question randomization and shuffling
- Quiz categories and tagging system
- Multiple attempts per quiz with score averaging
- Advanced analytics with interactive charts
- PDF/Excel report generation
- Email and SMS notifications
- Real-time quiz taking with leaderboards
- Mobile app support
- Integration with learning management systems (LMS)
- AI-powered question generation and analysis

## License

MIT License - feel free to use this project for your own purposes.
