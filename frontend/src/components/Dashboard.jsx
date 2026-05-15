import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TeacherHome } from './TeacherHome';
import { AdminLayout } from './AdminLayout';
import { AppLayout, parentNavItems } from './AppLayout';
import { AdminScheduleOverview } from './AdminScheduleOverview';
import { AdminDashboard } from './AdminDashboard';

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
 * Teacher Dashboard
 */
const TeacherDashboard = () => {
  return <TeacherHome />;
};

/**
 * Parent Dashboard
 */
const PARENT_TILES = [
  { icon: '👨‍👩‍👧‍👦', title: 'Мои дети', desc: 'Прогресс, группы и портфолио', path: '/parent/children', accent: '#eef2ff', accentBorder: '#c7d2fe' },
  { icon: '📅', title: 'Посещаемость', desc: 'Занятия, пропуски и отработки', path: '/parent/attendance', accent: '#ecfdf5', accentBorder: '#a7f3d0' },
  { icon: '💳', title: 'Оплата', desc: 'Баланс и история платежей', path: '/parent/billing', accent: '#fffbeb', accentBorder: '#fde68a' },
  { icon: '🏆', title: 'Проекты', desc: 'Лучшие работы учеников', path: '/projects', accent: '#fef2f2', accentBorder: '#fecaca' },
];

const ParentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <AppLayout title="KiberOne — Родитель" navItems={parentNavItems} kidMode>
      <div className="mb-4">
        <h1 className="fw-semibold mb-1" style={{ fontSize: '1.75rem' }}>
          Добро пожаловать{user?.first_name ? `, ${user.first_name}` : ''}!
        </h1>
        <div className="text-muted">Выберите раздел для просмотра</div>
      </div>

      <div className="row g-3">
        {PARENT_TILES.map((t) => (
          <div key={t.path} className="col-12 col-md-6">
            <button
              type="button"
              className="card border-0 shadow-sm rounded-4 w-100 text-start"
              style={{ cursor: 'pointer', transition: 'transform 0.15s ease' }}
              onClick={() => navigate(t.path)}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div className="card-body p-4 d-flex align-items-center gap-3">
                <div
                  className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 56, height: 56, background: t.accent, border: `1px solid ${t.accentBorder}`, fontSize: '1.5rem' }}
                >
                  {t.icon}
                </div>
                <div>
                  <div className="fw-semibold" style={{ fontSize: '1.05rem' }}>{t.title}</div>
                  <div className="text-muted small">{t.desc}</div>
                </div>
                <svg className="ms-auto flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
};

/**
 * Student Dashboard — теперь перенаправляет на новую дружелюбную главную ученика.
 */
const StudentDashboard = () => <Navigate to="/student" replace />;

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
