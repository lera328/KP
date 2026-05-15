import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KID_ICONS, IconLogout } from './KidIcons';

export const adminNavItems = [
  { label: 'Главная', iconKey: 'home', path: '/admin' },
  { label: 'Пользователи', iconKey: 'users', path: '/admin/users' },
  { label: 'Группы', iconKey: 'layers', path: '/admin/groups' },
  { label: 'Финансы', iconKey: 'wallet', path: '/admin/finance' },
  { label: 'Отработки', iconKey: 'clock', path: '/admin/makeups' },
  { label: 'Уведомления', iconKey: 'bell', path: '/admin/notifications' },
  { label: 'Аналитика', iconKey: 'chart', path: '/admin/analytics' },
  { label: 'Риск оттока', iconKey: 'alert', path: '/admin/churn-risk' },
  { label: 'Проекты', iconKey: 'palette', path: '/projects' },
];

export const teacherNavItems = [
  { label: 'Главная', iconKey: 'home', path: '/teacher' },
  { label: 'Расписание', iconKey: 'calendar', path: '/teacher/schedule' },
  { label: 'Отработки', iconKey: 'clock', path: '/teacher/makeup-slots' },
  { label: 'Проекты', iconKey: 'palette', path: '/projects' },
  { label: 'Зарплата', iconKey: 'wallet', path: '/teacher/salary' },
];

export const parentNavItems = [
  { label: 'Главная', iconKey: 'home', path: '/parent' },
  { label: 'Дети', iconKey: 'users', path: '/parent/children' },
  { label: 'Посещаемость', iconKey: 'calendar', path: '/parent/attendance' },
  { label: 'Оплата', iconKey: 'wallet', path: '/parent/billing' },
  { label: 'Проекты', iconKey: 'trophy', path: '/projects' },
];

export const studentNavItems = [
  { label: 'Главная', iconKey: 'home', path: '/student' },
  { label: 'Расписание', iconKey: 'calendar', path: '/student/schedule' },
  { label: 'Проекты', iconKey: 'palette', path: '/student/projects' },
  { label: 'Портфолио', iconKey: 'trophy', path: '/student/portfolio' },
];

export const getNavItemsForUser = (user, hasRole) => {
  if (!user) return [];
  if (hasRole('admin')) return adminNavItems;
  if (hasRole('teacher')) return teacherNavItems;
  if (hasRole('parent')) return parentNavItems;
  if (hasRole('student')) return studentNavItems;
  return [];
};

export const AppLayout = ({
  title,
  navItems,
  children,
  kidMode = false,
  bottomNav,
}) => {
  const showBottomNav = bottomNav ?? kidMode;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => {
    if (location.pathname === path) return true;
    // Подсветка для вложенных роутов (например /student/projects/...)
    if (path !== '/' && path.split('/').length > 1 && location.pathname.startsWith(path + '/')) {
      return true;
    }
    return false;
  };

  return (
    <div
      className={kidMode ? 'kid-shell' : ''}
      style={kidMode ? { minHeight: '100vh', background: '#f3f4f6' } : undefined}
    >
      <nav
        className={`navbar navbar-expand-lg navbar-dark ${kidMode ? 'kid-navbar' : ''}`}
        style={
          kidMode
            ? { background: 'rgba(31, 41, 55, 0.92)' }
            : { background: '#212529' }
        }
      >
        <div className="container-fluid">
          <span className="navbar-brand fw-semibold">{title}</span>
          <div className="ms-auto d-flex align-items-center">
            <span className="text-white me-3 d-none d-md-inline">
              {user?.first_name || user?.email}
            </span>
            <button
              className={
                kidMode
                  ? 'btn btn-light btn-sm rounded-pill px-3 d-flex align-items-center gap-2'
                  : 'btn btn-outline-light btn-sm'
              }
              onClick={handleLogout}
              aria-label="Выйти"
            >
              {kidMode ? <IconLogout width={16} height={16} /> : null}
              <span>Выйти</span>
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4 kid-page">
        <div className="row g-3">
          {navItems && navItems.length > 0 && (
            <div className={`col-md-3 col-lg-2 ${kidMode ? 'kid-top-nav-items' : ''}`}>
              <div
                className={kidMode ? 'card border-0 rounded-4' : 'card'}
                style={kidMode ? { boxShadow: 'var(--kid-shadow-sm)' } : undefined}
              >
                {!kidMode && (
                  <div className="card-header">
                    <strong>Разделы</strong>
                  </div>
                )}
                <div className={kidMode ? 'p-2 d-flex flex-column gap-1' : 'list-group list-group-flush'}>
                  {navItems.map((item) => {
                    const Icon = item.iconKey ? KID_ICONS[item.iconKey] : null;
                    if (kidMode) {
                      const active = isActive(item.path);
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className="btn text-start rounded-3 px-3 py-2 d-flex align-items-center gap-3 border-0"
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: active ? 600 : 500,
                            color: active ? '#111827' : '#4b5563',
                            background: active ? 'var(--kid-accent-soft)' : 'transparent',
                            transition: 'background 0.15s ease, color 0.15s ease',
                          }}
                          onClick={() => navigate(item.path)}
                        >
                          {Icon ? <Icon width={20} height={20} /> : null}
                          <span>{item.label}</span>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.path}
                        type="button"
                        className={`list-group-item list-group-item-action ${
                          isActive(item.path) ? 'active' : ''
                        }`}
                        onClick={() => navigate(item.path)}
                      >
                        {item.icon ? <span className="me-1">{item.icon}</span> : null}
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          <div className={navItems && navItems.length > 0 ? 'col-md-9 col-lg-10' : 'col-12'}>
            {children}
          </div>
        </div>
      </div>

      {showBottomNav && navItems && navItems.length > 0 && (
        <nav className="kid-bottom-nav" aria-label="Главная навигация">
          <div className="kid-bottom-nav-grid">
            {navItems.map((item) => {
              const Icon = item.iconKey ? KID_ICONS[item.iconKey] : null;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  type="button"
                  className={`kid-bottom-nav-item ${active ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                >
                  {Icon ? <Icon className="kid-bottom-nav-icon" /> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
