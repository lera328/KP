import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

export const StudentGroups = () => {
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGroups = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить ваши группы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <AppLayout title="КиберШкола — Ученик" navItems={studentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Список моих групп</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadGroups} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : groups.length === 0 ? (
              <div className="p-3 text-muted">Вы пока не прикреплены ни к одной группе.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Группа</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.id}>
                        <td>{group.name || `Группа #${group.id}`}</td>
                        <td>{group.is_active ? 'Активна' : 'Неактивна'}</td>
                      </tr>
                    ))}
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
