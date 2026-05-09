import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const adminNavItems = [
  { label: 'Главная', path: '/admin' },
  { label: 'Пользователи', path: '/admin/users' },
  { label: 'Группы', path: '/admin/groups' },
  { label: 'Курсы', path: '/admin/courses' },
  { label: 'Финансы', path: '/admin/finance' },
  { label: 'Посещаемость', path: '/admin/attendance' },
  { label: 'Отработки', path: '/admin/makeups' },
  { label: 'Уведомления', path: '/admin/notifications' },
  { label: 'Проекты', path: '/projects' },
];

export const teacherNavItems = [
  { label: 'Главная', path: '/teacher' },
  { label: 'Группы', path: '/teacher/groups' },
  { label: 'Посещаемость', path: '/teacher/attendance' },
  { label: 'Отработки', path: '/teacher/makeup-slots' },
  { label: 'Зарплата', path: '/teacher/salary' },
  { label: 'Проекты', path: '/projects' },
];

export const parentNavItems = [
  { label: 'Главная', path: '/parent' },
  { label: 'Дети', path: '/parent/children' },
  { label: 'Посещаемость', path: '/parent/attendance' },
  { label: 'Оплата', path: '/parent/billing' },
  { label: 'Проекты', path: '/projects' },
];

export const studentNavItems = [
  { label: 'Главная', path: '/student' },
  { label: 'Посещаемость', path: '/student/attendance' },
  { label: 'Лента проектов', path: '/projects' },
  { label: 'Портфолио', path: '/student/projects' },
];

export const getNavItemsForUser = (user, hasRole) => {
  if (!user) return [];
  if (hasRole('admin')) return adminNavItems;
  if (hasRole('teacher')) return teacherNavItems;
  if (hasRole('parent')) return parentNavItems;
  if (hasRole('student')) return studentNavItems;
  return [];
};

export const AppLayout = ({ title, navItems, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <span className="navbar-brand">{title}</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        <div className="row g-3">
          {navItems && navItems.length > 0 && (
            <div className="col-md-3 col-lg-2">
              <div className="card">
                <div className="card-header">
                  <strong>Разделы</strong>
                </div>
                <div className="list-group list-group-flush">
                  {navItems.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className={`list-group-item list-group-item-action ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={() => navigate(item.path)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className={navItems && navItems.length > 0 ? 'col-md-9 col-lg-10' : 'col-12'}>{children}</div>
        </div>
      </div>
    </div>
  );
};
