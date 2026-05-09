import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

export const TeacherGroups = () => {
  const navigate = useNavigate();
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
      setError(loadError.message || 'Не удалось загрузить группы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  return (
    <AppLayout title="KiberOne — Преподаватель" navItems={teacherNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Список групп</strong>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadGroups} disabled={loading}>
              Обновить
            </button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : groups.length === 0 ? (
              <div className="p-3 text-muted">У вас пока нет закреплённых групп.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Группа</th>
                      <th>Курс ID</th>
                      <th>Статус</th>
                      <th>Ученики</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => {
                      const students = Array.isArray(group.students) ? group.students : [];

                      return (
                        <tr key={group.id}>
                          <td>{group.name || `Группа #${group.id}`}</td>
                          <td>{group.course || '-'}</td>
                          <td>{group.is_active ? 'Активна' : 'Неактивна'}</td>
                          <td>
                            {students.length === 0
                              ? 'Нет учеников'
                              : students
                                  .map((student) => {
                                    const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
                                    return fullName || student.username || `ID ${student.id}`;
                                  })
                                  .join(', ')}
                          </td>
                          <td className="text-end">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => navigate('/teacher/attendance', { state: { preselectedGroupId: group.id } })}
                            >
                              Отметить посещаемость
                            </button>
                          </td>
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
