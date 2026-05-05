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

const formatTimeToNextLesson = (startsAt) => {
  if (!startsAt) return '';

  const now = new Date();
  const target = new Date(startsAt);
  const diffMs = target - now;

  if (diffMs <= 0) {
    return '0 дней';
  }

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `${days} дней`;
};

export const StudentAttendance = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [records, setRecords] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [attendanceData, lessonsData] = await Promise.all([api.getMyAttendance(), api.getLessons()]);
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить посещаемость.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const upcomingLessons = useMemo(() => {
    const now = new Date();
    return lessons
      .filter((lesson) => lesson.starts_at && new Date(lesson.starts_at) >= now)
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
      .slice(0, 10);
  }, [lessons]);

  const nextLesson = upcomingLessons.length > 0 ? upcomingLessons[0] : null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-warning">
        <div className="container-fluid">
          <button className="btn btn-outline-dark btn-sm me-2" onClick={() => navigate('/student')}>
            Назад
          </button>
          <span className="navbar-brand text-dark">Ученик — Посещаемость</span>
          <div className="ms-auto">
            <span className="text-dark me-3">{user?.email}</span>
            <button className="btn btn-outline-dark btn-sm" onClick={handleLogout}>
              Выйти
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid mt-4">
        {error && <div className="alert alert-danger">{error}</div>}

        <div className="row g-4">
          <div className="col-lg-7">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Моя посещаемость</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
                  Обновить
                </button>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : records.length === 0 ? (
                  <div className="p-3 text-muted">Записей посещаемости пока нет.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Группа</th>
                          <th>Статус</th>
                          <th>Списание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.id}>
                            <td>{formatDateTime(record.lesson_starts_at)}</td>
                            <td>{record.group_name || '-'}</td>
                            <td>{STATUS_LABELS[record.status] || record.status}</td>
                            <td>{record.charged ? 'Да' : 'Нет'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <strong>Ближайшие занятия</strong>
              </div>
              <div className="card-body p-0">
                {nextLesson && !loading && (
                  <div className="alert alert-info m-3 mb-0 py-2">
                    Следующее занятие через: <strong>{formatTimeToNextLesson(nextLesson.starts_at)}</strong>
                  </div>
                )}
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : upcomingLessons.length === 0 ? (
                  <div className="p-3 text-muted">Ближайших занятий пока нет.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {upcomingLessons.map((lesson) => (
                      <li key={lesson.id} className="list-group-item d-flex justify-content-between align-items-start">
                        <div>
                          <div className="fw-semibold">{formatDateTime(lesson.starts_at)}</div>
                          <small className="text-muted">Занятие #{lesson.id}</small>
                        </div>
                        <span className={`badge ${lesson.is_extra ? 'text-bg-warning' : 'text-bg-secondary'}`}>
                          {lesson.is_extra ? 'Разовое' : 'Регулярное'}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
