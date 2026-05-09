import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const HOUR_FROM = 9;
const HOUR_TO = 21;
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const startOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
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
  // Возвращает ISO 8601 для конкретного часа в локальной TZ (без секунд).
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

export const TeacherMakeupSlots = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [locations, setLocations] = useState([]);
  const [busyLessons, setBusyLessons] = useState([]);
  const [existingSlots, setExistingSlots] = useState([]);
  const [pendingCreates, setPendingCreates] = useState({}); // key -> {locationId, capacity}
  const [pendingDeletes, setPendingDeletes] = useState(new Set()); // existing slot IDs
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
      // Регулярные занятия учителя в пределах недели (не makeup-слоты)
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
    // key -> { type: 'busy'|'slot', payload }
    const map = new Map();
    busyLessons.forEach((lesson) => {
      const dt = new Date(lesson.starts_at);
      const dayIndex = (dt.getDay() + 6) % 7;
      const hour = dt.getHours();
      map.set(cellKey(dayIndex, hour), { type: 'busy', payload: lesson });
    });
    existingSlots.forEach((slot) => {
      const dt = new Date(slot.starts_at);
      const dayIndex = (dt.getDay() + 6) % 7;
      const hour = dt.getHours();
      map.set(cellKey(dayIndex, hour), { type: 'slot', payload: slot });
    });
    return map;
  }, [busyLessons, existingSlots]);

  const handleCellClick = (dayIndex, hour) => {
    const key = cellKey(dayIndex, hour);
    const existing = cellMap.get(key);

    if (existing?.type === 'busy') return;

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

    // Пустая ячейка — toggle pending create
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
      return { label: 'занят', className: 'bg-secondary text-white opacity-75', clickable: false };
    }
    if (existing?.type === 'slot') {
      const slot = existing.payload;
      const marked = pendingDeletes.has(slot.id);
      const loc = slot.location_name || '—';
      const tag = `${loc} · ${slot.booked || 0}/${slot.capacity || 2}`;
      return marked
        ? { label: `× удалить (${tag})`, className: 'bg-danger-subtle border-danger', clickable: true }
        : { label: tag, className: 'bg-warning-subtle border-warning', clickable: true };
    }
    const pending = pendingCreates[key];
    if (pending) {
      const loc = locations.find((l) => l.id === pending.locationId);
      return {
        label: `+ ${loc?.name || ''} · ${pending.capacity}`,
        className: 'bg-success-subtle border-success',
        clickable: true,
      };
    }
    return { label: '', className: '', clickable: true };
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
    <AppLayout title="KiberOne — Преподаватель" navItems={teacherNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="card mb-3">
          <div className="card-body d-flex flex-wrap gap-3 align-items-end">
            <div>
              <label className="form-label small text-muted mb-1">Неделя</label>
              <div className="btn-group">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => navWeek(-1)}>
                  ‹ Пред.
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={goToday}>
                  Сегодня
                </button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => navWeek(1)}>
                  След. ›
                </button>
              </div>
            </div>
            <div>
              <label className="form-label small text-muted mb-1">Период</label>
              <div>
                {formatDateLabel(weekStart)} — {formatDateLabel(addDays(weekStart, 6))}
              </div>
            </div>
            <div>
              <label className="form-label small text-muted mb-1">Локация (для новых слотов)</label>
              <select
                className="form-select form-select-sm"
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
              <label className="form-label small text-muted mb-1">Capacity</label>
              <select
                className="form-select form-select-sm"
                value={defaultCapacity}
                onChange={(e) => setDefaultCapacity(Number(e.target.value))}
                style={{ width: 80 }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </div>
            <div className="ms-auto d-flex gap-2 align-items-center">
              <span className="text-muted small">Изменений: {pendingCount}</span>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={loadData}
                disabled={loading || saving}
              >
                Обновить
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={loading || saving || pendingCount === 0}
              >
                {saving ? 'Сохраняем…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body p-0">
            {loading ? (
              <div className="p-3">Загрузка…</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered mb-0" style={{ tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}></th>
                      {weekDays.map((day, idx) => (
                        <th key={idx} className="text-center small">
                          <div>{WEEKDAY_LABELS[idx]}</div>
                          <div className="text-muted">{formatDateLabel(day)}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((hour) => (
                      <tr key={hour}>
                        <td className="text-muted small text-center align-middle">
                          {String(hour).padStart(2, '0')}:00
                        </td>
                        {weekDays.map((_, dayIdx) => {
                          const { label, className, clickable } = cellContent(dayIdx, hour);
                          return (
                            <td
                              key={dayIdx}
                              className={`small text-center align-middle ${className}`}
                              style={{
                                cursor: clickable ? 'pointer' : 'not-allowed',
                                height: 44,
                                userSelect: 'none',
                              }}
                              onClick={clickable ? () => handleCellClick(dayIdx, hour) : undefined}
                            >
                              {label}
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
          <div className="card-footer small text-muted">
            <span className="badge bg-secondary me-2">занят</span> регулярное занятие;
            <span className="badge bg-warning text-dark ms-3 me-2">слот</span> существующий слот отработки (клик → удалить, если нет брони);
            <span className="badge bg-success ms-3 me-2">+</span> новый слот (клик → отменить);
            пустая ячейка — клик создаёт слот в выбранной локации.
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
