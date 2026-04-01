import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';

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
    return <div className="container text-center mt-5">Loading...</div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginForm />} />
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
      <Route path="courses" element={<AdminCourses />} />
      <Route path="finance" element={<AdminFinance />} />
      <Route path="attendance" element={<AdminAttendance />} />
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
      <Route path="makeup-slots" element={<MakeupSlots />} />
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
      <Route path="children" element={<ParentChildren />} />
      <Route path="attendance" element={<ParentAttendance />} />
      <Route path="billing" element={<ParentBilling />} />
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
      <Route path="attendance" element={<StudentAttendance />} />
      <Route path="balance" element={<StudentBalance />} />
    </Routes>
  );
}

/**
 * Placeholder Pages - to be implemented
 */
const PlaceholderPage = ({ title }) => (
  <div className="container mt-5">
    <h2>{title}</h2>
    <p className="text-muted">This page is under development.</p>
  </div>
);

// Admin pages
const AdminDashboard = () => <Dashboard />;
const AdminUsers = () => <PlaceholderPage title="Manage Users" />;
const AdminCourses = () => <PlaceholderPage title="Manage Courses" />;
const AdminFinance = () => <PlaceholderPage title="Manage Finance" />;
const AdminAttendance = () => <PlaceholderPage title="Manage Attendance" />;

// Teacher pages
const TeacherDashboard = () => <Dashboard />;
const TeacherGroups = () => <PlaceholderPage title="My Groups" />;
const TeacherAttendance = () => <PlaceholderPage title="Mark Attendance" />;
const MakeupSlots = () => <PlaceholderPage title="Publish Makeup Slots" />;

// Parent pages
const ParentDashboard = () => <Dashboard />;
const ParentChildren = () => <PlaceholderPage title="My Children" />;
const ParentAttendance = () => <PlaceholderPage title="Children Attendance" />;
const ParentBilling = () => <PlaceholderPage title="Billing & Subscriptions" />;

// Student pages
const StudentDashboard = () => <Dashboard />;
const StudentGroups = () => <PlaceholderPage title="My Groups" />;
const StudentAttendance = () => <PlaceholderPage title="My Attendance" />;
const StudentBalance = () => <PlaceholderPage title="Lesson Balance" />;

// Error pages
const NotFoundPage = () => (
  <div className="container mt-5">
    <h2>404 - Page Not Found</h2>
    <p>The page you're looking for doesn't exist.</p>
  </div>
);

const UnauthorizedPage = () => (
  <div className="container mt-5">
    <div className="alert alert-danger">
      <h4>Access Denied</h4>
      <p>You don't have permission to access this page.</p>
    </div>
  </div>
);

export default App;
