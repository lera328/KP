import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/LoginForm';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { ForceChangePassword } from './components/ForceChangePassword';
import { Dashboard } from './components/Dashboard';
import { AdminUsers } from './components/AdminUsers';
import { TeacherAttendance } from './components/TeacherAttendance';
import { TeacherGroups } from './components/TeacherGroups';
import { StudentGroups } from './components/StudentGroups';
import { TeacherMakeupSlots } from './components/TeacherMakeupSlots';
import { TeacherSalary } from './components/TeacherSalary';
import { AdminSchedule } from './components/AdminSchedule';
import { ParentChildren } from './components/ParentChildren';
import { ParentAttendance } from './components/ParentAttendance';
import { ParentBilling } from './components/ParentBilling';
import { ProjectsFeed } from './components/ProjectsFeed';
import { StudentAttendance } from './components/StudentAttendance';
import { StudentProjects } from './components/StudentProjects';
import { StudentBalance } from './components/StudentBalance';
import { AdminFinance } from './components/AdminFinance';
import { AdminGroups } from './components/AdminGroups';
import { AdminNotifications } from './components/AdminNotifications';
import { AdminMakeups } from './components/AdminMakeups';
import { AdminCourses } from './components/AdminCourses';

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
      <Route path="courses" element={<AdminCourses />} />
      <Route path="finance" element={<AdminFinance />} />
      <Route path="attendance" element={<AdminAttendance />} />
      <Route path="makeups" element={<AdminMakeups />} />
      <Route path="notifications" element={<AdminNotifications />} />
    </Routes>
  );
}

/**
 * Teacher Routes
 */
function TeacherRoutes() {
  return (
    <Routes>
      <Route path="/" element={<TeacherDashboard />} />
      <Route path="groups" element={<TeacherGroups />} />
      <Route path="attendance" element={<TeacherAttendance />} />
      <Route path="makeup-slots" element={<TeacherMakeupSlots />} />
      <Route path="salary" element={<TeacherSalary />} />
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
      <Route path="/" element={<StudentDashboard />} />
      <Route path="groups" element={<StudentGroups />} />
      <Route path="attendance" element={<StudentAttendancePage />} />
      <Route path="projects" element={<StudentProjectsPage />} />
      <Route path="balance" element={<StudentBalancePage />} />
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
const AdminAttendance = () => <AdminSchedule />;

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
