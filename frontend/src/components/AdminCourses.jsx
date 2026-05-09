import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

export const AdminCourses = () => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingCourse, setEditingCourse] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  const loadCourses = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getCourses();
      setCourses(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить курсы.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const resetForm = () => {
    setForm({ name: '', description: '', is_active: true });
    setEditingCourse(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Укажите название курса.');
      return;
    }

    setSaving(true);
    try {
      if (editingCourse) {
        await api.updateCourse(editingCourse.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          is_active: form.is_active,
        });
        setSuccess('Курс обновлён.');
      } else {
        await api.createCourse({
          name: form.name.trim(),
          description: form.description.trim(),
          is_active: form.is_active,
        });
        setSuccess('Курс создан.');
      }
      resetForm();
      await loadCourses();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось сохранить курс.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (course) => {
    setEditingCourse(course);
    setForm({
      name: course.name || '',
      description: course.description || '',
      is_active: Boolean(course.is_active),
    });
  };

  const handleDelete = async (course) => {
    const confirmed = window.confirm(`Удалить курс "${course.name}"?`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.deleteCourse(course.id);
      setSuccess('Курс удалён.');
      if (editingCourse?.id === course.id) {
        resetForm();
      }
      await loadCourses();
    } catch (deleteError) {
      setError(deleteError.message || 'Не удалось удалить курс.');
    } finally {
      setSaving(false);
    }
  };

  const sortedCourses = useMemo(() => {
    return courses.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  }, [courses]);

  return (
    <AdminLayout title="Админ — Курсы">
      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <strong>{editingCourse ? 'Редактировать курс' : 'Создать курс'}</strong>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Название</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Описание</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    disabled={saving}
                  />
                </div>
                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    disabled={saving}
                    id="course-active"
                  />
                  <label className="form-check-label" htmlFor="course-active">
                    Активный курс
                  </label>
                </div>
                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Сохраняем...' : editingCourse ? 'Сохранить' : 'Создать'}
                  </button>
                  {editingCourse && (
                    <button type="button" className="btn btn-outline-secondary" onClick={resetForm} disabled={saving}>
                      Отменить
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <strong>Список курсов</strong>
              <button className="btn btn-outline-secondary btn-sm" onClick={loadCourses} disabled={loading}>
                Обновить
              </button>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3">Загрузка...</div>
              ) : sortedCourses.length === 0 ? (
                <div className="p-3 text-muted">Курсов пока нет.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Статус</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCourses.map((course) => (
                        <tr key={course.id}>
                          <td>
                            <div className="fw-semibold">{course.name}</div>
                            {course.description && <div className="text-muted small">{course.description}</div>}
                          </td>
                          <td>{course.is_active ? 'Активен' : 'Неактивен'}</td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <button className="btn btn-outline-primary btn-sm" onClick={() => handleEdit(course)}>
                                Редактировать
                              </button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(course)} disabled={saving}>
                                Удалить
                              </button>
                            </div>
                          </td>
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
    </AdminLayout>
  );
};
