import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { SearchableSelect } from './SearchableSelect';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

const toInputDateTime = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const userLabel = (item) => {
  if (!item) return '-';
  const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
  return fullName || item.username || `ID ${item.id}`;
};

export const AdminGroupModal = ({
  group,
  locations,
  teachers,
  students,
  topics = [],
  onClose,
  onChanged,
}) => {
  const [tab, setTab] = useState('info');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ---- Edit info form ----
  const [form, setForm] = useState({
    name: '',
    location: '',
    is_active: true,
    teacher_ids: [],
    student_ids: [],
  });
  const [savingInfo, setSavingInfo] = useState(false);

  // ---- Lessons ----
  const [lessons, setLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState(null);
  const [editTeacher, setEditTeacher] = useState('');
  const [savingLessonEdit, setSavingLessonEdit] = useState(false);
  const [deletingLessonId, setDeletingLessonId] = useState(null);

  // ---- Schedule setup ----
  const [scheduleForm, setScheduleForm] = useState({
    teacher: '',
    starts_at: toInputDateTime(new Date()),
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ---- Add extra lesson ----
  const [extraForm, setExtraForm] = useState({
    teacher: '',
    starts_at: toInputDateTime(new Date()),
  });
  const [savingExtra, setSavingExtra] = useState(false);

  // ---- Delete group ----
  const [deletingGroup, setDeletingGroup] = useState(false);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const topicMap = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  useEffect(() => {
    if (!group) return;
    setForm({
      name: group.name || '',
      location: group.location || '',
      is_active: !!group.is_active,
      teacher_ids: Array.isArray(group.teachers) ? group.teachers.map((t) => t.id) : [],
      student_ids: Array.isArray(group.students) ? group.students.map((s) => s.id) : [],
    });
    setScheduleForm((prev) => ({
      ...prev,
      teacher:
        Array.isArray(group.teachers) && group.teachers[0] ? String(group.teachers[0].id) : '',
    }));
    setExtraForm((prev) => ({
      ...prev,
      teacher:
        Array.isArray(group.teachers) && group.teachers[0] ? String(group.teachers[0].id) : '',
    }));
    setError('');
    setSuccess('');
    loadLessons(group.id);
  }, [group?.id]);

  const loadLessons = async (groupId) => {
    setLoadingLessons(true);
    try {
      const all = await api.getLessons();
      const filtered = (Array.isArray(all) ? all : [])
        .filter((l) => Number(l.group) === Number(groupId))
        .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      setLessons(filtered);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить уроки группы.');
    } finally {
      setLoadingLessons(false);
    }
  };

  const renderGroupSlot = () => {
    if (group.weekly_lesson_weekday === null || !group.weekly_lesson_time) return 'не задан';
    const weekday = WEEKDAY_LABELS[group.weekly_lesson_weekday] || `День #${group.weekly_lesson_weekday}`;
    return `${weekday} ${String(group.weekly_lesson_time).slice(0, 5)}`;
  };

  const toggleSelection = (field, id) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(id)
        ? prev[field].filter((x) => x !== id)
        : [...prev[field], id],
    }));
  };

  const handleSaveInfo = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.name.trim()) {
      setError('Название группы не может быть пустым.');
      return;
    }
    if (!form.location) {
      setError('Выберите локацию группы.');
      return;
    }

    setSavingInfo(true);
    try {
      await api.updateGroup(group.id, {
        name: form.name.trim(),
        location: Number(form.location),
        is_active: form.is_active,
        teacher_ids: form.teacher_ids,
        student_ids: form.student_ids,
      });
      setSuccess('Параметры группы сохранены.');
      onChanged();
    } catch (e) {
      setError(e.message || 'Не удалось сохранить группу.');
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSetupSchedule = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!scheduleForm.teacher || !scheduleForm.starts_at) {
      setError('Заполните преподавателя и стартовое время.');
      return;
    }
    setSavingSchedule(true);
    try {
      const result = await api.setupGroupSchedule({
        group_id: group.id,
        teacher_id: Number(scheduleForm.teacher),
        starts_at: new Date(scheduleForm.starts_at).toISOString(),
      });
      const created = Number(result?.created_count || 0);
      setSuccess(`Регулярное расписание настроено. Создано занятий: ${created}.`);
      await loadLessons(group.id);
      onChanged();
    } catch (e) {
      setError(e.message || 'Не удалось настроить расписание.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleAddExtra = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!extraForm.teacher || !extraForm.starts_at) {
      setError('Заполните преподавателя и дату/время разового занятия.');
      return;
    }
    setSavingExtra(true);
    try {
      await api.addExtraLesson({
        group_id: group.id,
        teacher_id: Number(extraForm.teacher),
        starts_at: new Date(extraForm.starts_at).toISOString(),
      });
      setSuccess('Разовое занятие добавлено.');
      await loadLessons(group.id);
    } catch (e) {
      setError(e.message || 'Не удалось добавить разовое занятие.');
    } finally {
      setSavingExtra(false);
    }
  };

  const startEditLesson = (lesson) => {
    setEditingLessonId(lesson.id);
    setEditTeacher(String(lesson.teacher));
  };

  const cancelEditLesson = () => {
    setEditingLessonId(null);
    setEditTeacher('');
  };

  const handleSaveLesson = async (lesson) => {
    if (!editTeacher) return;
    setSavingLessonEdit(true);
    setError('');
    setSuccess('');
    try {
      await api.updateLesson(lesson.id, { teacher: Number(editTeacher) });
      setSuccess('Преподаватель урока обновлён.');
      cancelEditLesson();
      await loadLessons(group.id);
    } catch (e) {
      setError(e.message || 'Не удалось обновить урок.');
    } finally {
      setSavingLessonEdit(false);
    }
  };

  const handleDeleteLesson = async (lesson) => {
    if (!window.confirm('Удалить этот урок?')) return;
    setDeletingLessonId(lesson.id);
    setError('');
    setSuccess('');
    try {
      await api.deleteLesson(lesson.id);
      setSuccess('Урок удалён.');
      await loadLessons(group.id);
    } catch (e) {
      setError(e.message || 'Не удалось удалить урок.');
    } finally {
      setDeletingLessonId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm(`Удалить группу "${group.name}" вместе со всеми её уроками? Это действие необратимо.`)) {
      return;
    }
    setDeletingGroup(true);
    setError('');
    setSuccess('');
    try {
      await api.deleteGroup(group.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e.message || 'Не удалось удалить группу.');
      setDeletingGroup(false);
    }
  };

  if (!group) return null;

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">
                Группа #{group.id} — {group.name}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              <ul className="nav nav-tabs mb-3">
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'info' ? 'active' : ''}`}
                    onClick={() => setTab('info')}
                  >
                    Параметры
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setTab('schedule')}
                  >
                    Расписание
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'lessons' ? 'active' : ''}`}
                    onClick={() => setTab('lessons')}
                  >
                    Уроки ({lessons.length})
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link text-danger ${tab === 'danger' ? 'active' : ''}`}
                    onClick={() => setTab('danger')}
                  >
                    Удаление
                  </button>
                </li>
              </ul>

              {error ? <div className="alert alert-danger">{error}</div> : null}
              {success ? <div className="alert alert-success">{success}</div> : null}

              {tab === 'info' ? (
                <form onSubmit={handleSaveInfo}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Название</label>
                      <input
                        className="form-control"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        disabled={savingInfo}
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Локация *</label>
                      <SearchableSelect
                        options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
                        value={form.location}
                        onChange={(v) => setForm((p) => ({ ...p, location: v }))}
                        disabled={savingInfo}
                        placeholder="— выберите локацию —"
                      />
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          id="group-active-edit"
                          type="checkbox"
                          className="form-check-input"
                          checked={form.is_active}
                          onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                          disabled={savingInfo}
                        />
                        <label className="form-check-label" htmlFor="group-active-edit">
                          Активная группа
                        </label>
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Преподаватели</label>
                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: '180px', overflow: 'auto' }}
                      >
                        {teachers.length === 0 ? (
                          <div className="text-muted small">Преподаватели не найдены.</div>
                        ) : (
                          teachers.map((t) => (
                            <label className="form-check d-block" key={t.id}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={form.teacher_ids.includes(t.id)}
                                onChange={() => toggleSelection('teacher_ids', t.id)}
                                disabled={savingInfo}
                              />
                              <span className="form-check-label">{userLabel(t)}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Ученики</label>
                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: '180px', overflow: 'auto' }}
                      >
                        {students.length === 0 ? (
                          <div className="text-muted small">Ученики не найдены.</div>
                        ) : (
                          students.map((s) => (
                            <label className="form-check d-block" key={s.id}>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={form.student_ids.includes(s.id)}
                                onChange={() => toggleSelection('student_ids', s.id)}
                                disabled={savingInfo}
                              />
                              <span className="form-check-label">{userLabel(s)}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={savingInfo}>
                      {savingInfo ? 'Сохраняем...' : 'Сохранить параметры'}
                    </button>
                  </div>
                </form>
              ) : null}

              {tab === 'schedule' ? (
                <div>
                  <div className="alert alert-info">
                    Текущий регулярный слот: <strong>{renderGroupSlot()}</strong>. Локация:{' '}
                    <strong>{group.location_name || 'не задана'}</strong>.
                  </div>

                  <h6>Настроить регулярное расписание</h6>
                  <p className="text-muted small">
                    Создаст еженедельные уроки на год вперёд по выбранному дню недели и времени.
                    Слот группы автоматически обновится.
                  </p>
                  <form onSubmit={handleSetupSchedule} className="row g-3">
                    <div className="col-md-5">
                      <label className="form-label">Преподаватель</label>
                      <SearchableSelect
                        options={teachers.map((t) => ({ value: t.id, label: userLabel(t) }))}
                        value={scheduleForm.teacher}
                        onChange={(v) => setScheduleForm((p) => ({ ...p, teacher: v }))}
                        disabled={savingSchedule}
                        placeholder="— выберите —"
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">Стартовое занятие</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={scheduleForm.starts_at}
                        onChange={(e) =>
                          setScheduleForm((p) => ({ ...p, starts_at: e.target.value }))
                        }
                        disabled={savingSchedule}
                      />
                    </div>
                    <div className="col-md-2 d-flex align-items-end">
                      <button
                        type="submit"
                        className="btn btn-dark rounded-pill w-100"
                        disabled={savingSchedule}
                      >
                        {savingSchedule ? '...' : 'Прописать'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}

              {tab === 'lessons' ? (
                <div>
                  <div className="card mb-3">
                    <div className="card-header">
                      <strong>Добавить разовое занятие</strong>
                    </div>
                    <div className="card-body">
                      <form onSubmit={handleAddExtra} className="row g-3">
                        <div className="col-md-5">
                          <label className="form-label">Преподаватель</label>
                          <SearchableSelect
                            options={teachers.map((t) => ({ value: t.id, label: userLabel(t) }))}
                            value={extraForm.teacher}
                            onChange={(v) => setExtraForm((p) => ({ ...p, teacher: v }))}
                            disabled={savingExtra}
                            placeholder="— выберите —"
                          />
                        </div>
                        <div className="col-md-5">
                          <label className="form-label">Дата и время</label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            value={extraForm.starts_at}
                            onChange={(e) =>
                              setExtraForm((p) => ({ ...p, starts_at: e.target.value }))
                            }
                            disabled={savingExtra}
                          />
                        </div>
                        <div className="col-md-2 d-flex align-items-end">
                          <button
                            type="submit"
                            className="btn btn-dark rounded-pill w-100"
                            disabled={savingExtra}
                          >
                            {savingExtra ? '...' : 'Добавить'}
                          </button>
                        </div>
                        <div className="col-12">
                          <div className="form-text">
                            Система не даст занять уже занятый слот по локации/преподавателю.
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>

                  <h6>Уроки группы</h6>
                  {loadingLessons ? (
                    <div>Загрузка...</div>
                  ) : lessons.length === 0 ? (
                    <div className="text-muted">Уроков пока нет.</div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>Дата и время</th>
                            <th>Тип</th>
                            <th>Тема</th>
                            <th>Преподаватель</th>
                            <th className="text-end">Действия</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lessons.map((lesson) => {
                            const isEditing = editingLessonId === lesson.id;
                            const teacher = teacherMap.get(lesson.teacher);
                            return (
                              <tr key={lesson.id}>
                                <td>{formatDateTime(lesson.starts_at)}</td>
                                <td>{lesson.is_extra ? 'Разовое' : 'Регулярное'}</td>
                                <td>{topicMap.get(lesson.topic)?.title || '-'}</td>
                                <td>
                                  {isEditing ? (
                                    <SearchableSelect
                                      size="sm"
                                      options={teachers.map((t) => ({ value: t.id, label: userLabel(t) }))}
                                      value={editTeacher}
                                      onChange={setEditTeacher}
                                      disabled={savingLessonEdit}
                                    />
                                  ) : (
                                    userLabel(teacher)
                                  )}
                                </td>
                                <td className="text-end">
                                  {isEditing ? (
                                    <div className="d-flex gap-2 justify-content-end">
                                      <button
                                        className="btn btn-dark rounded-pill btn-sm"
                                        onClick={() => handleSaveLesson(lesson)}
                                        disabled={savingLessonEdit}
                                      >
                                        {savingLessonEdit ? '...' : 'Сохранить'}
                                      </button>
                                      <button
                                        className="btn btn-light border rounded-pill btn-sm"
                                        onClick={cancelEditLesson}
                                        disabled={savingLessonEdit}
                                      >
                                        Отмена
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="d-flex gap-2 justify-content-end">
                                      <button
                                        className="btn btn-dark rounded-pill btn-sm"
                                        onClick={() => startEditLesson(lesson)}
                                      >
                                        Сменить педагога
                                      </button>
                                      <button
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => handleDeleteLesson(lesson)}
                                        disabled={deletingLessonId === lesson.id}
                                      >
                                        {deletingLessonId === lesson.id ? '...' : 'Удалить'}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'danger' ? (
                <div>
                  <div className="alert alert-warning">
                    Удаление группы навсегда уберёт её, все её уроки и записи посещаемости.
                  </div>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteGroup}
                    disabled={deletingGroup}
                  >
                    {deletingGroup ? 'Удаляем...' : 'Удалить группу'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
