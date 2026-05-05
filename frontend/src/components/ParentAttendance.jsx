import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_LABELS = {
  present: 'Присутствовал',
  absent: 'Пропуск',
  makeup: 'Отработка',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const ParentAttendance = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [children, setChildren] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAttendance = async (studentId = '') => {
    setLoading(true);
    setError('');
    try {
      const [childrenData, attendanceData] = await Promise.all([
        api.getParentChildren(),
        api.getParentAttendance(studentId),
      ]);
      setChildren(Array.isArray(childrenData) ? childrenData : []);
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить посещаемость.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const childMap = useMemo(() => new Map(children.map((child) => [child.id, child])), [children]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleFilterChange = (value) => {
    setSelectedStudent(value);
    loadAttendance(value);
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-success">
        <div className="container-fluid">
          <button className="btn btn-outline-light btn-sm me-2" onClick={() => navigate('/parent')}>
            Назад
          </button>
          <span className="navbar-brand">Родитель — Посещаемость</span>
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
            <strong>Записи посещаемости</strong>
            <div className="d-flex gap-2">
              <select
                className="form-select form-select-sm"
                value={selectedStudent}
                onChange={(event) => handleFilterChange(event.target.value)}
                disabled={loading}
              >
                <option value="">Все дети</option>
                {children.map((child) => {
                  const name = `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username;
                  return (
                    <option key={child.id} value={child.id}>
                      {name}
                    </option>
                  );
                })}
              </select>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => loadAttendance(selectedStudent)} disabled={loading}>
                Обновить
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : records.length === 0 ? (
              <div className="p-3 text-muted">Записи посещаемости пока отсутствуют.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Ребёнок</th>
                      <th>Группа</th>
                      <th>Статус</th>
                      <th>Списание</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => {
                      const child = childMap.get(record.student_id);
                      const childName = child
                        ? `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username
                        : record.student_name;

                      return (
                        <tr key={record.id}>
                          <td>{formatDateTime(record.lesson_starts_at)}</td>
                          <td>{childName || '-'}</td>
                          <td>{record.group_name || '-'}</td>
                          <td>{STATUS_LABELS[record.status] || record.status}</td>
                          <td>{record.charged ? 'Да' : 'Нет'}</td>
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
