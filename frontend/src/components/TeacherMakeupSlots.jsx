import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const HOUR_FROM = 9;
const HOUR_TO = 21;
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
};

const addDays = (date, n) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateLabel = (d) =>
  d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

const cellKey = (dayIndex, hour) => `${dayIndex}_${hour}`;

const localISO = (date, hour) => {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const TeacherMakeupSlots = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [locations, setLocations] = useState([]);
  const [busyLessons, setBusyLessons] = useState([]);
  const [existingSlots, setExistingSlots] = useState([]);
  const [pendingCreates, setPendingCreates] = useState({});
  const [pendingDeletes, setPendingDeletes] = useState(new Set());
  const [defaultLocationId, setDefaultLocationId] = useState('');
  const [defaultCapacity, setDefaultCapacity] = useState(2);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const hours = useMemo(
    () => Array.from({ length: HOUR_TO - HOUR_FROM }, (_, i) => HOUR_FROM + i),
    [],
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const from = isoDate(weekStart);
      const to = isoDate(addDays(weekStart, 6));
      const [locsData, lessonsData, slotsData] = await Promise.all([
        api.getLocations(),
        api.getLessons(),
        api.getTeacherMakeupSlots({ from, to }),
      ]);
      const locs = Array.isArray(locsData) ? locsData : [];
      setLocations(locs);
      if (!defaultLocationId && locs.length > 0) {
        setDefaultLocationId(String(locs[0].id));
      }
      const start = new Date(weekStart);
      const end = addDays(weekStart, 7);
      const busy = (Array.isArray(lessonsData) ? lessonsData : []).filter((lesson) => {
        if (!lesson.starts_at) return false;
        if (lesson.is_makeup_slot) return false;
        const dt = new Date(lesson.starts_at);
        return dt >= start && dt < end;
      });
      setBusyLessons(busy);
      setExistingSlots(Array.isArray(slotsData) ? slotsData : []);
      setPendingCreates({});
      setPendingDeletes(new Set());
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить расписание.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const cellMap = useMemo(() => {
    const map = new Map();
    busyLessons.forEach((lesson) => {
      const dt = new Date(lesson.starts_at);
      const dayIndex = (dt.getDay() + 6) % 7;
      const hour = dt.getHours();
      map.set(cellKey(dayIndex, hour), { type: 'busy', payload: lesson });
    });
    // Свои слоты имеют приоритет над чужими в одной ячейке.
    // Чужие слоты агрегируем в массив, чтобы показать всех коллег.
    const othersBucket = new Map();
    existingSlots.forEach((slot) => {
      const dt = new Date(slot.starts_at);
      const dayIndex = (dt.getDay() + 6) % 7;
      const hour = dt.getHours();
      const key = cellKey(dayIndex, hour);
      if (slot.is_mine) {
        if (map.get(key)?.type !== 'busy') {
          map.set(key, { type: 'slot', payload: slot });
        }
      } else {
        const arr = othersBucket.get(key) || [];
        arr.push(slot);
        othersBucket.set(key, arr);
      }
    });
    othersBucket.forEach((slots, key) => {
      if (!map.has(key)) {
        map.set(key, { type: 'other', payload: slots });
      }
    });
    return map;
  }, [busyLessons, existingSlots]);

  const handleCellClick = (dayIndex, hour) => {
    const key = cellKey(dayIndex, hour);
    const existing = cellMap.get(key);

    if (existing?.type === 'busy') return;
    if (existing?.type === 'other') return;

    if (existing?.type === 'slot') {
      const slot = existing.payload;
      if ((slot.booked || 0) > 0) {
        setError(`Слот ${formatDateLabel(weekDays[dayIndex])} ${hour}:00 занят бронированием — удалить нельзя.`);
        return;
      }
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        if (next.has(slot.id)) next.delete(slot.id);
        else next.add(slot.id);
        return next;
      });
      return;
    }

    if (!defaultLocationId) {
      setError('Выберите локацию по умолчанию');
      return;
    }
    setPendingCreates((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          locationId: Number(defaultLocationId),
          capacity: Number(defaultCapacity) || 2,
        };
      }
      return next;
    });
  };

  const cellContent = (dayIndex, hour) => {
    const key = cellKey(dayIndex, hour);
    const existing = cellMap.get(key);

    if (existing?.type === 'busy') {
      return {
        label: 'занят',
        bg: '#e5e7eb',
        color: '#6b7280',
        clickable: false,
      };
    }
    if (existing?.type === 'other') {
      const slots = existing.payload;
      const first = slots[0];
      const more = slots.length > 1 ? ` +${slots.length - 1}` : '';
      const teacherLabel = (first.teacher_name || 'Коллега').split(' ')[0];
      const locLabel = first.location_name || '—';
      return {
        label: `${teacherLabel}${more}`,
        sub: locLabel,
        bg: '#f3f4f6',
        color: '#6b7280',
        clickable: false,
        title: slots
          .map(
            (s) =>
              `${s.teacher_name || 'Коллега'} · ${s.location_name || '—'} (${s.booked || 0}/${s.capacity || 2})`,
          )
          .join('\n'),
      };
    }
    if (existing?.type === 'slot') {
      const slot = existing.payload;
      const marked = pendingDeletes.has(slot.id);
      const loc = slot.location_name || '—';
      if (marked) {
        return {
          label: `× ${loc}`,
          sub: `${slot.booked || 0}/${slot.capacity || 2}`,
          bg: '#fef2f2',
          color: '#dc2626',
          clickable: true,
        };
      }
      return {
        label: loc,
        sub: `${slot.booked || 0}/${slot.capacity || 2}`,
        bg: '#fef3c7',
        color: '#b45309',
        clickable: true,
      };
    }
    const pending = pendingCreates[key];
    if (pending) {
      const loc = locations.find((l) => l.id === pending.locationId);
      return {
        label: `+ ${loc?.name || ''}`,
        sub: `cap ${pending.capacity}`,
        bg: '#ecfdf5',
        color: '#16a34a',
        clickable: true,
      };
    }
    return { label: '', bg: '', color: '', clickable: true };
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const create = Object.entries(pendingCreates).map(([key, value]) => {
        const [dayIdx, hourStr] = key.split('_').map(Number);
        const startsAt = localISO(weekDays[dayIdx], hourStr);
        return {
          location_id: value.locationId,
          starts_at: startsAt,
          capacity: value.capacity,
        };
      });
      const deletePayload = Array.from(pendingDeletes);
      if (create.length === 0 && deletePayload.length === 0) {
        setSuccess('Нет изменений');
        return;
      }
      await api.saveTeacherMakeupSlots({ create, delete: deletePayload });
      setSuccess(`Сохранено: создано ${create.length}, удалено ${deletePayload.length}`);
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (saveError) {
      setError(saveError.message || 'Не удалось сохранить слоты.');
    } finally {
      setSaving(false);
    }
  };

  const navWeek = (delta) => {
    setWeekStart((prev) => addDays(prev, delta * 7));
  };

  const goToday = () => setWeekStart(startOfWeek(new Date()));

  const pendingCount = Object.keys(pendingCreates).length + pendingDeletes.size;

  return (
    <AppLayout title="КиберШкола" navItems={teacherNavItems} kidMode>
      <div className="mb-4 d-flex flex-wrap align-items-center gap-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>
          Слоты отработок
        </h1>
        <div className="ms-auto d-flex gap-2 flex-wrap align-items-center">
          <div className="btn-group">
            <button
              type="button"
              className="btn btn-light border rounded-start-pill px-3"
              onClick={() => navWeek(-1)}
              aria-label="Назад"
            >
              ‹
            </button>
            <button
              type="button"
              className="btn btn-light border px-3"
              onClick={goToday}
            >
              Сегодня
            </button>
            <button
              type="button"
              className="btn btn-light border rounded-end-pill px-3"
              onClick={() => navWeek(1)}
              aria-label="Вперёд"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Краткая инструкция */}
      <div
        className="rounded-4 p-3 mb-3 d-flex gap-3 align-items-start"
        style={{ background: '#eef2ff', color: '#3730a3', border: '1px solid #e0e7ff' }}
      >
        <div
          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          style={{ width: 32, height: 32, background: '#c7d2fe', color: '#3730a3', fontWeight: 700 }}
        >
          i
        </div>
        <div className="small" style={{ lineHeight: 1.55 }}>
          <div className="fw-semibold mb-1" style={{ color: '#1e1b4b' }}>
            Как работают слоты отработок
          </div>
          <ol className="mb-0 ps-3">
            <li>
              Выберите в верхней панели <b>локацию</b> и <b>вместимость</b> для новых слотов.
            </li>
            <li>
              Кликните по <b>пустой ячейке</b> — она станет <span style={{ color: '#16a34a', fontWeight: 600 }}>зелёной</span> (будет создана).
              Клик по <span style={{ color: '#b45309', fontWeight: 600 }}>жёлтой</span> — пометит слот на удаление <span style={{ color: '#dc2626', fontWeight: 600 }}>красным</span>.
              <span style={{ color: '#6b7280' }}> Повторный клик отменит изменение.</span>
            </li>
            <li>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>Тёмно-серые</span> — ваши регулярные занятия,
              <span style={{ color: '#6b7280', fontWeight: 600 }}> светло-серые</span> — слоты других преподавателей (наведите для деталей). Эти ячейки не изменяются.
            </li>
            <li>
              Нажмите <b>«Сохранить»</b>, чтобы применить изменения. Занятые родителями слоты удалить нельзя.
            </li>
          </ol>
        </div>
      </div>

      {/* Период + параметры по умолчанию */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 d-flex flex-wrap align-items-center gap-3">
          <div>
            <div className="text-muted small">Период</div>
            <div className="fw-semibold">
              {formatDateLabel(weekStart)} — {formatDateLabel(addDays(weekStart, 6))}
            </div>
          </div>

          <div className="vr d-none d-md-block" />

          <div>
            <label className="form-label small text-muted mb-1">
              Локация для новых слотов
            </label>
            <select
              className="form-select form-select-sm rounded-pill"
              value={defaultLocationId}
              onChange={(e) => setDefaultLocationId(e.target.value)}
              style={{ minWidth: 180 }}
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label small text-muted mb-1">Вместимость</label>
            <select
              className="form-select form-select-sm rounded-pill"
              value={defaultCapacity}
              onChange={(e) => setDefaultCapacity(Number(e.target.value))}
              style={{ width: 90 }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          <div className="ms-auto d-flex gap-2 align-items-center">
            {pendingCount > 0 && (
              <span
                className="badge rounded-pill"
                style={{ background: '#eef0f3', color: '#1f2937', fontWeight: 500 }}
              >
                Изменений: {pendingCount}
              </span>
            )}
            <button
              type="button"
              className="btn btn-light border rounded-pill px-3"
              onClick={loadData}
              disabled={loading || saving}
            >
              Обновить
            </button>
            <button
              type="button"
              className="btn btn-dark rounded-pill px-4"
              onClick={handleSave}
              disabled={loading || saving || pendingCount === 0}
            >
              {saving ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      {/* Сетка */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-3">
              <div className="kid-skeleton mb-2" style={{ height: 40 }} />
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="kid-skeleton mb-2" style={{ height: 36 }} />
              ))}
            </div>
          ) : (
            <div className="table-responsive">
              <table
                className="table mb-0 align-middle"
                style={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        width: 70,
                        background: '#ffffff',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    />
                    {weekDays.map((day, idx) => {
                      const isToday = isSameDay(day, today);
                      return (
                        <th
                          key={idx}
                          className="text-center small"
                          style={{
                            background: isToday ? '#eef0f3' : '#ffffff',
                            color: isToday ? '#111827' : '#6b7280',
                            fontWeight: isToday ? 700 : 500,
                            borderBottom: '1px solid #e5e7eb',
                            padding: '10px 4px',
                          }}
                        >
                          <div>{WEEKDAY_LABELS[idx]}</div>
                          <div
                            style={{
                              fontWeight: isToday ? 600 : 400,
                              fontSize: '0.75rem',
                            }}
                          >
                            {formatDateLabel(day)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {hours.map((hour) => (
                    <tr key={hour}>
                      <td
                        className="text-muted small text-center"
                        style={{
                          padding: '4px',
                          borderRight: '1px solid #f3f4f6',
                          background: '#fafafa',
                        }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </td>
                      {weekDays.map((_, dayIdx) => {
                        const { label, sub, bg, color, clickable, title } = cellContent(dayIdx, hour);
                        return (
                          <td
                            key={dayIdx}
                            style={{
                              padding: 4,
                              borderTop: '1px solid #f3f4f6',
                            }}
                          >
                            <div
                              className="rounded-3 d-flex flex-column align-items-center justify-content-center text-center"
                              title={title || undefined}
                              style={{
                                background: bg || '#ffffff',
                                color: color || '#9ca3af',
                                cursor: clickable ? 'pointer' : 'not-allowed',
                                height: 50,
                                fontSize: '0.78rem',
                                fontWeight: 500,
                                userSelect: 'none',
                                transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                                border: bg ? 'none' : '1px dashed #e5e7eb',
                              }}
                              onClick={
                                clickable
                                  ? () => handleCellClick(dayIdx, hour)
                                  : undefined
                              }
                              onMouseEnter={(e) => {
                                if (clickable && !bg) {
                                  e.currentTarget.style.background = '#f8f9fb';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (clickable && !bg) {
                                  e.currentTarget.style.background = '#ffffff';
                                }
                              }}
                            >
                              {label && <div>{label}</div>}
                              {sub && (
                                <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                  {sub}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div
          className="card-footer border-0 small text-muted d-flex flex-wrap gap-3 align-items-center"
          style={{ background: '#fafafa', borderRadius: '0 0 16px 16px' }}
        >
          <Legend color="#6b7280" bg="#e5e7eb" label="Регулярное занятие" />
          <Legend color="#6b7280" bg="#f3f4f6" label="Слот другого преподавателя" />
          <Legend color="#b45309" bg="#fef3c7" label="Ваш слот" />
          <Legend color="#16a34a" bg="#ecfdf5" label="Будет создан" />
          <Legend color="#dc2626" bg="#fef2f2" label="Будет удалён" />
          <span className="ms-auto">
            Клик по пустой ячейке создаёт слот, по существующему — удаляет.
          </span>
        </div>
      </div>
    </AppLayout>
  );
};

const Legend = ({ color, bg, label }) => (
  <span className="d-inline-flex align-items-center gap-2">
    <span
      className="rounded-2"
      style={{ background: bg, width: 14, height: 14, display: 'inline-block' }}
    />
    <span style={{ color }}>{label}</span>
  </span>
);

export default TeacherMakeupSlots;
