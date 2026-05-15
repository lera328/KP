import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/LoginForm';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { ForceChangePassword } from './components/ForceChangePassword';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { StudentGroups } from './components/StudentGroups';
import { TeacherHome } from './components/TeacherHome';
import { TeacherSchedule } from './components/TeacherSchedule';
import { TeacherMakeupSlots } from './components/TeacherMakeupSlots';
import { TeacherSalary } from './components/TeacherSalary';
import { TeacherGroupDetail } from './components/TeacherGroupDetail';
import { TeacherStudentDetail } from './components/TeacherStudentDetail';
import { ParentChildren } from './components/ParentChildren';
import { ParentAttendance } from './components/ParentAttendance';
import { ParentBilling } from './components/ParentBilling';
import { ProjectsFeed } from './components/ProjectsFeed';
import { StudentAttendance } from './components/StudentAttendance';
import { StudentProjects } from './components/StudentProjects';
import { StudentHome } from './components/StudentHome';
import { StudentSchedulePage } from './components/StudentSchedulePage';
import { StudentProjectsHub } from './components/StudentProjectsHub';
import { Portfolio } from './components/Portfolio';
import { StudentBalance } from './components/StudentBalance';
import { AdminFinance } from './components/AdminFinance';
import { AdminGroups } from './components/AdminGroups';
import { AdminNotifications } from './components/AdminNotifications';
import { AdminMakeups } from './components/AdminMakeups';
import AdminChurnRisk from './components/AdminChurnRisk';
import AdminAnalytics from './components/AdminAnalytics';
import { AdminScheduleOverview } from './components/AdminScheduleOverview';
import { AdminTeacherDetail } from './components/AdminTeacherDetail';
import { AdminGroupDetail } from './components/AdminGroupDetail';
import { AdminStudentDetail } from './components/AdminStudentDetail';
import MakeupConfirm from './components/MakeupConfirm';

/**
 * Main App - sets up routing and auth context
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

/**
 * AppRoutes - defines all routes in the application
 */
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="container text-center mt-5">Загрузка...</div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/m/:token" element={<MakeupConfirm />} />
      <Route
        path="/force-change-password"
        element={
          <ProtectedRoute allowDuringForceChange>
            <ForceChangePassword />
          </ProtectedRoute>
        }
      />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectsFeed />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin/*"
        element={
          <RoleRoute requiredRole="admin">
            <AdminRoutes />
          </RoleRoute>
        }
      />

      {/* Teacher routes */}
      <Route
        path="/teacher/*"
        element={
          <RoleRoute requiredRole="teacher">
            <TeacherRoutes />
          </RoleRoute>
        }
      />

      {/* Parent routes */}
      <Route
        path="/parent/*"
        element={
          <RoleRoute requiredRole="parent">
            <ParentRoutes />
          </RoleRoute>
        }
      />

      {/* Student routes */}
      <Route
        path="/student/*"
        element={
          <RoleRoute requiredRole="student">
            <StudentRoutes />
          </RoleRoute>
        }
      />

      {/* Default route */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/login" />}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/**
 * Admin Routes
 */
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
      <Route path="groups" element={<AdminGroups />} />
      <Route path="groups/:id" element={<AdminGroupDetail />} />
      <Route path="schedule" element={<AdminScheduleOverview />} />
      <Route path="teachers/:id" element={<AdminTeacherDetail />} />
      <Route path="students/:id" element={<AdminStudentDetail />} />
      <Route path="finance" element={<AdminFinance />} />
      <Route path="makeups" element={<AdminMakeups />} />
      <Route path="notifications" element={<AdminNotifications />} />
      <Route path="churn-risk" element={<AdminChurnRisk />} />
      <Route path="analytics" element={<AdminAnalytics />} />
    </Routes>
  );
}

/**
 * Teacher Routes
 */
function TeacherRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TeacherHome />} />
      <Route path="schedule" element={<TeacherSchedule />} />
      <Route path="makeup-slots" element={<TeacherMakeupSlots />} />
      <Route path="salary" element={<TeacherSalary />} />
      <Route path="groups/:id" element={<TeacherGroupDetail />} />
      <Route path="students/:id" element={<TeacherStudentDetail />} />
      {/* Backwards compatibility — старые ссылки */}
      <Route path="groups" element={<Navigate to="/teacher" replace />} />
      <Route path="attendance" element={<Navigate to="/teacher/schedule" replace />} />
    </Routes>
  );
}

/**
 * Parent Routes
 */
function ParentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ParentDashboard />} />
      <Route path="children" element={<ParentChildrenPage />} />
      <Route path="children/:studentId/portfolio" element={<Portfolio mode="parent" />} />
      <Route path="attendance" element={<ParentAttendancePage />} />
      <Route path="billing" element={<ParentBillingPage />} />
    </Routes>
  );
}

/**
 * Student Routes
 */
function StudentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StudentHome />} />
      <Route path="schedule" element={<StudentSchedulePage />} />
      <Route path="projects" element={<StudentProjectsHub />} />
      <Route path="portfolio" element={<Portfolio mode="student" />} />
      {/* Legacy routes — оставлены для прямых ссылок */}
      <Route path="groups" element={<StudentGroups />} />
      <Route path="attendance" element={<Navigate to="/student/schedule" replace />} />
      <Route path="balance" element={<StudentBalancePage />} />
      <Route path="projects/old" element={<StudentProjectsPage />} />
    </Routes>
  );
}

/**
 * Placeholder Pages - to be implemented
 */
const PlaceholderPage = ({ title }) => (
  <div className="container mt-5">
    <h2>{title}</h2>
    <p className="text-muted">Эта страница находится в разработке.</p>
  </div>
);

// Admin pages
const AdminDashboard = () => <Dashboard />;

// Teacher pages
const TeacherDashboard = () => <Dashboard />;

// Parent pages
const ParentDashboard = () => <Dashboard />;
const ParentChildrenPage = () => <ParentChildren />;
const ParentAttendancePage = () => <ParentAttendance />;
const ParentBillingPage = () => <ParentBilling />;

// Student pages
const StudentDashboard = () => <Dashboard />;
const StudentAttendancePage = () => <StudentAttendance />;
const StudentProjectsPage = () => <StudentProjects />;
const StudentBalancePage = () => <StudentBalance />;

// Error pages
const NotFoundPage = () => (
  <div className="container mt-5">
    <h2>404 — Страница не найдена</h2>
    <p>Запрашиваемая страница не существует.</p>
  </div>
);

const UnauthorizedPage = () => (
  <div className="container mt-5">
    <div className="alert alert-danger">
      <h4>Доступ запрещён</h4>
      <p>У вас нет прав для доступа к этой странице.</p>
    </div>
  </div>
);

export default App;
