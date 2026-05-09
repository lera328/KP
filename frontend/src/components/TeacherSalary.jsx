import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const TeacherSalary = () => {
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
      const data = await api.getTeacherSalary();
      setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
      if (Number.isFinite(Number(data?.rate_per_lesson))) {
        setRatePerLesson(Number(data.rate_per_lesson));
      }
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить уроки для расчёта ЗП.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons();
  }, []);

  const conductedCount = lessons.length;
  const baseAmount = conductedCount * toNumber(ratePerLesson);
  const totalAmount = baseAmount + toNumber(bonus) - toNumber(penalty);

  return (
    <AppLayout title="KiberOne — Преподаватель" navItems={teacherNavItems}>
      <div>
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
                ) : lessons.length === 0 ? (
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
                        {lessons.map((lesson) => (
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
    </AppLayout>
  );
};
