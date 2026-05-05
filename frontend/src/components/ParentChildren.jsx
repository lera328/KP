import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export const ParentChildren = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadChildren = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getParentChildren();
      setChildren(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить список детей.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChildren();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-success">
        <div className="container-fluid">
          <button className="btn btn-outline-light btn-sm me-2" onClick={() => navigate('/parent')}>
            Назад
          </button>
          <span className="navbar-brand">Родитель — Мои дети</span>
          <div className="ms-auto">
            <span className="text-white me-3">{user?.email}</span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Список детей</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadChildren} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : children.length === 0 ? (
              <div className="p-3 text-muted">Дети пока не привязаны к этому аккаунту.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Имя</th>
                      <th>Логин</th>
                      <th>Группы</th>
                      <th>Баланс занятий</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((item) => {
                      const displayName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.username;
                      const groups = Array.isArray(item.groups) && item.groups.length > 0
                        ? item.groups.map((group) => group.name).join(', ')
                        : '-';

                      return (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{displayName}</td>
                          <td>{item.username || '-'}</td>
                          <td>{groups}</td>
                          <td>{item.balance ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
