import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const TeacherSalary = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratePerLesson, setRatePerLesson] = useState(1500);
  const [bonus, setBonus] = useState(0);
  const [penalty, setPenalty] = useState(0);

  const loadLessons = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getLessons();
      setLessons(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить уроки для расчёта ЗП.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, []);

  const currentMonthData = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    const monthLessons = lessons.filter((lesson) => {
      if (!lesson.starts_at) return false;
      const dt = new Date(lesson.starts_at);
      return dt.getMonth() === month && dt.getFullYear() === year;
    });

    const conductedLessons = monthLessons.filter(
      (lesson) => (lesson.conducted_topic && lesson.conducted_topic.trim()) || (lesson.conducted_description && lesson.conducted_description.trim()),
    );

    return {
      monthLessons,
      conductedLessons,
    };
  }, [lessons]);

  const conductedCount = currentMonthData.conductedLessons.length;
  const baseAmount = conductedCount * toNumber(ratePerLesson);
  const totalAmount = baseAmount + toNumber(bonus) - toNumber(penalty);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-info">
        <div className="container-fluid">
          <button className="btn btn-outline-light btn-sm me-2" onClick={() => navigate('/teacher')}>
            Назад
          </button>
          <span className="navbar-brand">Расчёт собственной ЗП</span>
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

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Параметры расчёта</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadLessons} disabled={loading}>
                  Обновить
                </button>
              </div>
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Ставка за проведённый урок</label>
                  <input
                    type="number"
                    className="form-control"
                    value={ratePerLesson}
                    onChange={(event) => setRatePerLesson(event.target.value)}
                    min={0}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Премии</label>
                  <input
                    type="number"
                    className="form-control"
                    value={bonus}
                    onChange={(event) => setBonus(event.target.value)}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label">Штрафы</label>
                  <input
                    type="number"
                    className="form-control"
                    value={penalty}
                    onChange={(event) => setPenalty(event.target.value)}
                  />
                </div>

                <hr />
                <p className="mb-1">Проведённых уроков за месяц: <strong>{conductedCount}</strong></p>
                <p className="mb-1">База: <strong>{baseAmount.toLocaleString('ru-RU')} ₽</strong></p>
                <p className="mb-0">Итого: <strong>{totalAmount.toLocaleString('ru-RU')} ₽</strong></p>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card">
              <div className="card-header">
                <strong>Проведённые уроки текущего месяца</strong>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : currentMonthData.conductedLessons.length === 0 ? (
                  <div className="p-3 text-muted">Проведённые уроки в этом месяце не найдены.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Дата и время</th>
                          <th>ID группы</th>
                          <th>Тема</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentMonthData.conductedLessons.map((lesson) => (
                          <tr key={lesson.id}>
                            <td>{lesson.starts_at ? new Date(lesson.starts_at).toLocaleString('ru-RU') : '-'}</td>
                            <td>{lesson.group || '-'}</td>
                            <td>{lesson.conducted_topic || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
