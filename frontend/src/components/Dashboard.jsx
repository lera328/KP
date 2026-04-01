import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Main Dashboard - routes to role-specific dashboard
 */
export const Dashboard = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Determine which dashboard to show
  if (hasRole('admin')) {
    return <AdminDashboard />;
  } else if (hasRole('teacher')) {
    return <TeacherDashboard />;
  } else if (hasRole('parent')) {
    return <ParentDashboard />;
  } else if (hasRole('student')) {
    return <StudentDashboard />;
  }

  return <DefaultDashboard />;
};

/**
 * Admin Dashboard
 */
const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <span className="navbar-brand">KiberOne Admin</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <div className="row">
          <div className="col-md-12">
            <h1>Admin Dashboard</h1>
            <p>Welcome, {user?.first_name || 'Admin'}!</p>
          </div>
        </div>

        <div className="row mt-4">
          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Users</h5>
                <p className="card-text">Manage users and roles</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/admin/users')}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Courses</h5>
                <p className="card-text">Manage courses and groups</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/admin/courses')}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Finance</h5>
                <p className="card-text">Manage subscriptions and payments</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/admin/finance')}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Attendance</h5>
                <p className="card-text">Mark attendance and manage makeups</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/admin/attendance')}
                >
                  Manage
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Teacher Dashboard
 */
const TeacherDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-info">
        <div className="container-fluid">
          <span className="navbar-brand">KiberOne - Teacher</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <h1>Teacher Dashboard</h1>
        <p>Welcome, {user?.first_name || 'Teacher'}!</p>

        <div className="row mt-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">My Groups</h5>
                <p className="card-text">View and manage your groups</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/teacher/groups')}
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Mark Attendance</h5>
                <p className="card-text">Record student attendance</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/teacher/attendance')}
                >
                  Record
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Makeup Slots</h5>
                <p className="card-text">Publish makeup slots</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/teacher/makeup-slots')}
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Parent Dashboard
 */
const ParentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-success">
        <div className="container-fluid">
          <span className="navbar-brand">KiberOne - Parent</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <h1>Parent Dashboard</h1>
        <p>Welcome, {user?.first_name || 'Parent'}!</p>

        <div className="row mt-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">My Children</h5>
                <p className="card-text">View your children's progress</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/children')}
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Attendance</h5>
                <p className="card-text">Check attendance records</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/attendance')}
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Billing</h5>
                <p className="card-text">View subscriptions and payments</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/billing')}
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Student Dashboard
 */
const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-warning">
        <div className="container-fluid">
          <span className="navbar-brand">KiberOne - Student</span>
          <div className="ms-auto">
            <span className="text-dark me-3">{user?.email}</span>
            <button
              className="btn btn-outline-dark btn-sm"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <h1>Student Dashboard</h1>
        <p>Welcome, {user?.first_name || 'Student'}!</p>

        <div className="row mt-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">My Groups</h5>
                <p className="card-text">View your enrolled groups</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/student/groups')}
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Attendance</h5>
                <p className="card-text">Check your attendance</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/student/attendance')}
                >
                  View
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Lessons Remaining</h5>
                <p className="card-text">Check your subscription balance</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/student/balance')}
                >
                  View
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Default Dashboard - for users with no specific role
 */
const DefaultDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-secondary">
        <div className="container-fluid">
          <span className="navbar-brand">KiberOne</span>
          <button
            className="btn btn-outline-light btn-sm ms-auto"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="container mt-5">
        <div className="alert alert-warning">
          <h4>No Role Assigned</h4>
          <p>Please contact an administrator to assign a role to your account.</p>
        </div>
      </div>
    </div>
  );
};
