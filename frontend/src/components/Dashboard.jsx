import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TeacherSchedule } from './TeacherSchedule';
import { StudentSchedule } from './StudentSchedule';
import { AdminLayout } from './AdminLayout';

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
  const { user } = useAuth();

  return (
    <AdminLayout title="KiberOne — Администратор">
        <div className="row">
          <div className="col-md-12">
            <h1>Панель администратора</h1>
            <p>Добро пожаловать, {user?.first_name || 'Администратор'}!</p>
          </div>
        </div>

        <div className="mt-3">
          <AdminScheduleOverview embedded />
        </div>
    </AdminLayout>
  );
};

/**
 * Teacher Dashboard
 */
const TeacherDashboard = () => {
  return <TeacherSchedule />;
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
          <span className="navbar-brand">KiberOne — Родитель</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button
              className="btn btn-outline-light btn-sm"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <h1>Панель родителя</h1>
        <p>Добро пожаловать, {user?.first_name || 'Родитель'}!</p>

        <div className="row mt-4">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Мои дети</h5>
                <p className="card-text">Просмотр прогресса ваших детей</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/children')}
                >
                  Открыть
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Посещаемость</h5>
                <p className="card-text">Проверка записей посещаемости</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/attendance')}
                >
                  Открыть
                </button>
              </div>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">Оплата</h5>
                <p className="card-text">Просмотр абонементов и платежей</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => navigate('/parent/billing')}
                >
                  Открыть
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
          <span className="navbar-brand">KiberOne — Ученик</span>
          <div className="ms-auto">
            <span className="text-dark me-3">{user?.email}</span>
            <button
              className="btn btn-outline-dark btn-sm"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <h1>Панель ученика</h1>
        <p>Добро пожаловать, {user?.first_name || 'Ученик'}!</p>

        <div className="row mt-3 g-3">
          <div className="col-md-3 col-lg-2">
            <div className="card">
              <div className="card-header">
                <strong>Разделы</strong>
              </div>
              <div className="list-group list-group-flush">
                <button className="list-group-item list-group-item-action" onClick={() => navigate('/student/attendance')}>
                  Посещаемость
                </button>
                <button className="list-group-item list-group-item-action" onClick={() => navigate('/student/projects')}>
                  Портфолио и проекты
                </button>
              </div>
            </div>
          </div>
          <div className="col-md-9 col-lg-10">
            <div className="card">
              <div className="card-header">
                <strong>📅 Расписание</strong>
              </div>
              <div className="card-body">
                <StudentSchedule />
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
            Выйти
          </button>
        </div>
      </nav>

      <div className="container mt-5">
        <div className="alert alert-warning">
          <h4>Роль не назначена</h4>
          <p>Обратитесь к администратору, чтобы назначить роль вашей учетной записи.</p>
        </div>
      </div>
    </div>
  );
};
