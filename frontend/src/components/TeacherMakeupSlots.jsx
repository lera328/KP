import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const getNext14DaysRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 14);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const TeacherMakeupSlots = () => {
  const [groups, setGroups] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, lessonsData] = await Promise.all([api.getGroups(), api.getLessons()]);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить уроки для слотов отработок.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const ids = lessons
      .filter((lesson) => lesson.is_makeup_slot)
      .map((lesson) => Number(lesson.id));
    setSelectedIds(new Set(ids));
  }, [lessons]);

  const groupMap = useMemo(() => {
    const map = new Map();
    for (const group of groups) {
      map.set(group.id, group);
    }
    return map;
  }, [groups]);

  const slotCandidates = useMemo(() => {
    const { start, end } = getNext14DaysRange();
    return lessons
      .filter((lesson) => {
        if (!lesson.starts_at) return false;
        const dt = new Date(lesson.starts_at);
        return dt >= start && dt <= end;
      })
      .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }, [lessons]);

  const toggleSlot = (lessonId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) {
        next.delete(lessonId);
      } else {
        next.add(lessonId);
      }
      return next;
    });
  };

  const saveSlots = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.updateMakeupSlots(Array.from(selectedIds));
      setSuccess('Слоты отработок сохранены.');
      await loadData();
    } catch {
      setError('Не удалось сохранить слоты отработок.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="KiberOne — Преподаватель" navItems={teacherNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <strong>Выберите уроки (следующие 14 дней), доступные для отработок</strong>
            <div className="d-flex gap-2">
              <button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading || saving}>
                Обновить
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveSlots} disabled={loading || saving}>
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка...</div>
            ) : slotCandidates.length === 0 ? (
              <div className="p-3 text-muted">Нет уроков в ближайшие 14 дней.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-hover mb-0">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Дата и время</th>
                      <th>Группа</th>
                      <th>Тема</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slotCandidates.map((lesson) => {
                      const group = groupMap.get(lesson.group);
                      return (
                        <tr key={lesson.id}>
                          <td style={{ width: 56 }}>
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={selectedIds.has(lesson.id)}
                              onChange={() => toggleSlot(lesson.id)}
                            />
                          </td>
                          <td>{new Date(lesson.starts_at).toLocaleString('ru-RU')}</td>
                          <td>{group?.name || `Группа #${lesson.group}`}</td>
                          <td>{lesson.conducted_topic || '-'}</td>
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
