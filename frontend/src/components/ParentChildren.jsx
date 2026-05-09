import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

export const ParentChildren = () => {
  const { user } = useAuth();

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

  return (
    <AppLayout title="KiberOne — Родитель" navItems={parentNavItems}>
      <div>
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
    </AppLayout>
  );
};
