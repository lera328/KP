import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Главная', path: '/admin' },
  { label: 'Пользователи', path: '/admin/users' },
  { label: 'Группы', path: '/admin/groups' },
  { label: 'Финансы', path: '/admin/finance' },
  { label: 'Посещаемость', path: '/admin/attendance' },
];

export const AdminLayout = ({ title, children }) => {
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
          <div className="col-md-3 col-lg-2">
            <div className="card">
              <div className="card-header">
                <strong>Разделы</strong>
              </div>
              <div className="list-group list-group-flush">
                {NAV_ITEMS.map((item) => (
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
          <div className="col-md-9 col-lg-10">{children}</div>
        </div>
      </div>
    </div>
  );
};
