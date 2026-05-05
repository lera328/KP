import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Присутствовал' },
  { value: 'absent', label: 'Пропуск' },
  { value: 'makeup', label: 'Отработка' },
];

export const TeacherAttendance = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const preselectedGroupId = location.state?.preselectedGroupId ? String(location.state.preselectedGroupId) : '';

  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentMarks, setRecentMarks] = useState([]);

  const [form, setForm] = useState({
    groupId: preselectedGroupId,
    lessonId: '',
    studentId: '',
    status: 'present',
  });

  useEffect(() => {
    if (!preselectedGroupId) {
      return;
    }

    setForm((prev) => {
      if (String(prev.groupId) === preselectedGroupId) {
        return prev;
      }

      return {
        ...prev,
        groupId: preselectedGroupId,
        lessonId: '',
        studentId: '',
      };
    });
  }, [preselectedGroupId]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, lessonsData] = await Promise.all([api.getGroups(), api.getLessons()]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить данные посещаемости.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedGroup = useMemo(
    () => groups.find((group) => String(group.id) === String(form.groupId)) || null,
    [groups, form.groupId],
  );

  const groupStudents = useMemo(() => {
    if (!selectedGroup || !Array.isArray(selectedGroup.students)) {
      return [];
    }
    return selectedGroup.students;
  }, [selectedGroup]);

  const groupLessons = useMemo(() => {
    if (!form.groupId) {
      return [];
    }
    return lessons.filter((lesson) => String(lesson.group) === String(form.groupId));
  }, [lessons, form.groupId]);

  const selectedLesson = useMemo(
    () => groupLessons.find((lesson) => String(lesson.id) === String(form.lessonId)) || null,
    [groupLessons, form.lessonId],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleGroupChange = (value) => {
    setForm((prev) => ({
      ...prev,
      groupId: value,
      lessonId: '',
      studentId: '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.groupId || !form.lessonId || !form.studentId || !form.status) {
      setError('Заполните группу, занятие, ученика и статус.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lesson_id: Number(form.lessonId),
        student_id: Number(form.studentId),
        status: form.status,
      };

      const result = await api.markAttendance(payload);
      const markedStudent = groupStudents.find((student) => String(student.id) === String(form.studentId));
      const statusText = STATUS_OPTIONS.find((option) => option.value === form.status)?.label || form.status;
      const studentName = markedStudent
        ? `${markedStudent.first_name || ''} ${markedStudent.last_name || ''}`.trim() || markedStudent.username
        : `ID ${form.studentId}`;

      setRecentMarks((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          lessonId: form.lessonId,
          student: studentName,
          status: statusText,
          charged: result?.charged ? 'Да' : 'Нет',
          createdAt: new Date().toLocaleString('ru-RU'),
        },
        ...prev,
      ]);

      setSuccess(`Отметка сохранена: ${studentName} — ${statusText}.`);
    } catch (saveError) {
      setError(saveError.message || 'Не удалось сохранить отметку.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <nav className="navbar navbar-expand-lg navbar-dark bg-info">
        <div className="container-fluid">
          <button className="btn btn-outline-light btn-sm me-2" onClick={() => navigate('/teacher')}>
            Назад
          </button>
          <span className="navbar-brand">Отметка посещаемости</span>
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
        {success && <div className="alert alert-success">{success}</div>}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Форма отметки</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading || saving}>
                  Обновить
                </button>
              </div>
              <div className="card-body">
                {loading ? (
                  <div>Загрузка...</div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Группа *</label>
                      <select
                        className="form-select"
                        value={form.groupId}
                        onChange={(event) => handleGroupChange(event.target.value)}
                        disabled={saving}
                        required
                      >
                        <option value="">Выберите группу</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Занятие *</label>
                      <select
                        className="form-select"
                        value={form.lessonId}
                        onChange={(event) => setField('lessonId', event.target.value)}
                        disabled={saving || !form.groupId}
                        required
                      >
                        <option value="">Выберите занятие</option>
                        {groupLessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id}>
                            #{lesson.id} — {lesson.starts_at ? new Date(lesson.starts_at).toLocaleString('ru-RU') : 'Без даты'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Ученик *</label>
                      <select
                        className="form-select"
                        value={form.studentId}
                        onChange={(event) => setField('studentId', event.target.value)}
                        disabled={saving || !form.groupId}
                        required
                      >
                        <option value="">Выберите ученика</option>
                        {groupStudents.map((student) => {
                          const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
                          return (
                            <option key={student.id} value={student.id}>
                              {fullName || student.username || `ID ${student.id}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Статус *</label>
                      <select
                        className="form-select"
                        value={form.status}
                        onChange={(event) => setField('status', event.target.value)}
                        disabled={saving}
                        required
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedLesson && (
                      <div className="alert alert-info py-2">
                        Выбрано занятие: #{selectedLesson.id}{' '}
                        {selectedLesson.starts_at ? `(${new Date(selectedLesson.starts_at).toLocaleString('ru-RU')})` : ''}
                      </div>
                    )}

                    <button className="btn btn-primary" type="submit" disabled={saving}>
                      {saving ? 'Сохраняем...' : 'Сохранить отметку'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card">
              <div className="card-header">
                <strong>Последние отметки (текущая сессия)</strong>
              </div>
              <div className="card-body p-0">
                {recentMarks.length === 0 ? (
                  <div className="p-3 text-muted">Пока нет отметок в этой сессии.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-striped table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Время</th>
                          <th>Занятие</th>
                          <th>Ученик</th>
                          <th>Статус</th>
                          <th>Списание</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentMarks.map((row) => (
                          <tr key={row.id}>
                            <td>{row.createdAt}</td>
                            <td>#{row.lessonId}</td>
                            <td>{row.student}</td>
                            <td>{row.status}</td>
                            <td>{row.charged}</td>
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
