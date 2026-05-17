import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { IconSearch, IconCheck } from './KidIcons';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Был', color: '#16a34a', bg: '#ecfdf5' },
  { value: 'absent', label: 'Пропуск', color: '#dc2626', bg: '#fef2f2' },
];

const formatDateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/**
 * Универсальная модалка проведения урока.
 * Используется на /teacher (Главная) и /teacher/schedule.
 *
 * Props:
 *  - lesson: объект Lesson
 *  - group: объект Group (со students[])
 *  - onClose(): закрыть
 *  - onSaved(): успешно сохранено
 */
export const ConductLessonModal = ({ lesson, group, onClose, onSaved }) => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const prefix = hasRole('admin') ? '/admin' : '/teacher';
  const isMakeup = Boolean(lesson?.is_makeup_slot);

  // Для слотов отработок берём учеников из makeup_students; для обычных — из group.students.
  const studentsSource = useMemo(() => {
    if (isMakeup) {
      const list = Array.isArray(lesson?.makeup_students) ? lesson.makeup_students : [];
      return list.map((s) => ({
        id: s.student_id,
        fullName: s.student_name || `ID ${s.student_id}`,
        subtitle: [s.absence_group, s.absence_topic].filter(Boolean).join(' · '),
      }));
    }
    const list = Array.isArray(group?.students) ? group.students : [];
    return list.map((s) => ({
      id: s.id,
      fullName:
        `${s.first_name || ''} ${s.last_name || ''}`.trim() ||
        s.username ||
        `ID ${s.id}`,
      subtitle: '',
    }));
  }, [isMakeup, lesson, group]);

  const existingAttendance = useMemo(
    () => (Array.isArray(lesson?.attendance_records) ? lesson.attendance_records : []),
    [lesson],
  );

  const [topic, setTopic] = useState(lesson?.conducted_topic || '');
  const [description, setDescription] = useState(lesson?.conducted_description || '');
  const [homework, setHomework] = useState(lesson?.homework || '');
  const [rows, setRows] = useState(() => {
    const recordByStudentId = new Map(
      existingAttendance
        .filter((r) => r && r.student_id && r.status)
        .map((r) => [Number(r.student_id), r]),
    );
    return studentsSource.map((s) => {
      const existing = recordByStudentId.get(Number(s.id));
      return {
        studentId: s.id,
        studentName: s.fullName,
        subtitle: s.subtitle,
        status: existing?.status || 'present',
        grade: existing?.grade != null ? String(existing.grade) : '',
        teacher_comment: existing?.teacher_comment || '',
      };
    });
  });
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Esc для закрытия
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.studentName.toLowerCase().includes(q));
  }, [rows, search]);

  const updateRow = (studentId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, [field]: value } : r)),
    );
  };

  const setAllStatus = (status) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (rows.length === 0) {
      setError('В этой группе нет учеников.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.conductLesson(lesson.id, {
        topic,
        description,
        homework,
        attendance: rows.map((r) => ({
          student_id: r.studentId,
          status: r.status,
          grade: r.grade === '' ? null : Number(r.grade),
          teacher_comment: r.teacher_comment || '',
        })),
      });
      onSaved && onSaved();
    } catch (e2) {
      setError(e2.message || 'Не удалось сохранить.');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = rows.filter((r) => r.status === 'present').length;
  const absentCount = rows.filter((r) => r.status === 'absent').length;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0 align-items-start">
            <div className="flex-grow-1">
              <div className="text-muted small">{formatDateTime(lesson?.starts_at)}</div>
              <h5 className="modal-title fw-semibold mb-0">
                {lesson?.is_makeup_slot
                  ? 'Слот отработки'
                  : group?.name || lesson?.group_name || `Группа #${lesson?.group}`}
              </h5>
            </div>
            <div className="d-flex align-items-center gap-2">
              {!lesson?.is_makeup_slot && lesson?.group && (
                <button
                  type="button"
                  className="btn btn-sm btn-light border rounded-pill px-3"
                  onClick={() => {
                    onClose && onClose();
                    navigate(`${prefix}/groups/${lesson.group}`);
                  }}
                  disabled={saving}
                  title="Открыть страницу группы"
                >
                  Открыть группу →
                </button>
              )}
              <button type="button" className="btn-close" onClick={onClose} disabled={saving} />
            </div>
          </div>

          <form onSubmit={submit} className="d-flex flex-column" style={{ minHeight: 0 }}>
            <div className="modal-body pt-0">
              {error && <div className="alert alert-danger rounded-3">{error}</div>}

              {isMakeup && (
                <div className="text-muted small mb-3">
                  Слот отработки
                  {Array.isArray(lesson.makeup_students)
                    ? ` · записано ${lesson.makeup_students.length}/${lesson.makeup_capacity || 2}`
                    : ''}
                </div>
              )}

              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label small text-muted">Тема урока</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Например: Циклы в Python"
                    disabled={saving}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small text-muted">
                    Домашнее задание (общее)
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    value={homework}
                    onChange={(e) => setHomework(e.target.value)}
                    placeholder="Что задано на дом"
                    disabled={saving}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small text-muted">Описание занятия</label>
                  <textarea
                    className="form-control rounded-3"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Кратко: что разобрали, какие задачи решали"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Сводка + быстрые действия */}
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span
                  className="badge rounded-pill"
                  style={{ background: '#ecfdf5', color: '#16a34a', fontWeight: 500 }}
                >
                  Был: {presentCount}
                </span>
                <span
                  className="badge rounded-pill"
                  style={{ background: '#fef2f2', color: '#dc2626', fontWeight: 500 }}
                >
                  Пропуск: {absentCount}
                </span>
                <span className="text-muted small ms-2">
                  Всего: {rows.length}
                </span>
                <div className="ms-auto d-flex gap-2 flex-wrap">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border rounded-pill px-3 d-flex align-items-center gap-1"
                    onClick={() => setAllStatus('present')}
                    disabled={saving}
                  >
                    <IconCheck width={14} height={14} /> Все были
                  </button>
                </div>
              </div>

              {/* Поиск */}
              {rows.length > 5 && (
                <div className="mb-3 position-relative">
                  <span
                    className="position-absolute"
                    style={{
                      top: 10,
                      left: 12,
                      color: '#9ca3af',
                      pointerEvents: 'none',
                    }}
                  >
                    <IconSearch width={18} height={18} />
                  </span>
                  <input
                    type="text"
                    className="form-control rounded-3 ps-5"
                    placeholder="Поиск по ученику…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}

              {/* Таблица посещаемости */}
              {rows.length === 0 ? (
                <div className="rounded-3 p-4 text-center text-muted" style={{ background: '#f8f9fb' }}>
                  {isMakeup
                    ? 'На этот слот пока никто не записался.'
                    : 'В этой группе нет учеников.'}
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filteredRows.map((row) => (
                    <StudentRow
                      key={row.studentId}
                      row={row}
                      saving={saving}
                      onChange={(field, value) => updateRow(row.studentId, field, value)}
                      onOpenStudent={() => {
                        onClose && onClose();
                        navigate(`${prefix}/students/${row.studentId}`);
                      }}
                    />
                  ))}
                  {filteredRows.length === 0 && (
                    <div className="text-muted text-center py-3">Никого не найдено.</div>
                  )}
                </div>
              )}
            </div>

            <div
              className="modal-footer border-0 sticky-bottom"
              style={{ background: '#fff', borderTop: '1px solid #e5e7eb' }}
            >
              <button
                type="button"
                className="btn btn-light border rounded-pill px-4"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-dark rounded-pill px-4"
                disabled={saving}
              >
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const StudentRow = ({ row, saving, onChange, onOpenStudent }) => {
  const meta = STATUS_OPTIONS.find((s) => s.value === row.status) || STATUS_OPTIONS[0];
  const isAbsent = row.status === 'absent';

  return (
    <div
      className="rounded-3 p-2 p-md-3"
      style={{ background: '#f8f9fb', borderLeft: `3px solid ${meta.color}` }}
    >
      <div className="d-flex flex-wrap align-items-center gap-2">
        <div className="flex-grow-1" style={{ minWidth: 160 }}>
          <button
            type="button"
            className="btn btn-link p-0 fw-semibold text-start text-decoration-none"
            style={{ color: '#111827' }}
            onClick={onOpenStudent}
            title="Открыть карточку ученика"
          >
            {row.studentName}
          </button>
          {row.subtitle && (
            <div className="text-muted small" style={{ lineHeight: 1.2 }}>
              {row.subtitle}
            </div>
          )}
        </div>

        {/* Статусы — сегментированный контрол */}
        <div className="btn-group" role="group" aria-label="Статус">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="btn btn-sm rounded-pill px-3"
              style={{
                background: row.status === opt.value ? opt.bg : '#ffffff',
                color: row.status === opt.value ? opt.color : '#6b7280',
                border: `1px solid ${
                  row.status === opt.value ? opt.color : '#e5e7eb'
                }`,
                fontWeight: row.status === opt.value ? 600 : 500,
                marginRight: 4,
              }}
              onClick={() => onChange('status', opt.value)}
              disabled={saving}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Оценка */}
        <select
          className="form-select form-select-sm rounded-pill"
          style={{ width: 90 }}
          value={row.grade}
          onChange={(e) => onChange('grade', e.target.value)}
          disabled={saving || isAbsent}
          title="Оценка"
        >
          <option value="">—</option>
          <option value="5">5</option>
          <option value="4">4</option>
          <option value="3">3</option>
          <option value="2">2</option>
          <option value="1">1</option>
        </select>
      </div>

      {/* Комментарий — раскрывается на полную ширину */}
      <input
        type="text"
        className="form-control form-control-sm rounded-3 mt-2 border-0"
        style={{ background: '#ffffff' }}
        placeholder="Заметка по ученику (необязательно)"
        value={row.teacher_comment}
        onChange={(e) => onChange('teacher_comment', e.target.value)}
        disabled={saving}
      />
    </div>
  );
};

export default ConductLessonModal;
