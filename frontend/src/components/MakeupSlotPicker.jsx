import { useMemo, useState } from 'react';

const formatTime = (value) =>
  new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

const formatDateHeader = (value) => {
  const d = new Date(value);
  return d.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
};

const dateKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Модал-календарь для выбора слота отработки.
 *
 * props:
 *  - absence: запись пропуска (для заголовка)
 *  - slots: массив слотов с полями lesson_id, starts_at, teacher_name, location_id, location_name
 *  - loading: bool
 *  - accepting: { [lessonId]: bool } — индикатор отправки заявки
 *  - onPick: (lessonId) => void
 *  - onClose: () => void
 */
export const MakeupSlotPicker = ({
  absence,
  slots,
  loading,
  accepting,
  onPick,
  onClose,
  successMessage,
}) => {
  const [locationFilter, setLocationFilter] = useState('all');

  const locations = useMemo(() => {
    const map = new Map();
    for (const s of slots || []) {
      if (s.location_id && !map.has(s.location_id)) {
        map.set(s.location_id, s.location_name || `Локация #${s.location_id}`);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [slots]);

  const filtered = useMemo(() => {
    if (locationFilter === 'all') return slots || [];
    return (slots || []).filter((s) => String(s.location_id) === String(locationFilter));
  }, [slots, locationFilter]);

  const counts = useMemo(() => {
    const map = new Map();
    map.set('all', (slots || []).length);
    for (const s of slots || []) {
      const k = String(s.location_id || 'none');
      map.set(k, (map.get(k) || 0) + 1);
    }
    return map;
  }, [slots]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const s of filtered) {
      const k = dateKey(s.starts_at);
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    }
    // сортируем слоты внутри дня по времени
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    }
    // массив [{ key, label, slots }] упорядоченный по дате
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, dayslots]) => ({
        key,
        label: formatDateHeader(dayslots[0].starts_at),
        slots: dayslots,
      }));
  }, [filtered]);

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} />
      <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">Выбор слота отработки</h5>
                {absence ? (
                  <div className="text-muted small">
                    Пропуск: {new Date(absence.lesson_starts_at).toLocaleString('ru-RU')}
                    {absence.group_name ? ` · ${absence.group_name}` : ''}
                  </div>
                ) : null}
              </div>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>

            <div className="modal-body">
              {successMessage ? (
                <div className="alert alert-success mb-0">{successMessage}</div>
              ) : null}
              {successMessage ? null : (
                <>
              {/* Фильтр по локации */}
              <div className="mb-3">
                <div className="text-muted small mb-1">Локация</div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm ${
                      locationFilter === 'all' ? 'btn-primary' : 'btn-outline-primary'
                    }`}
                    onClick={() => setLocationFilter('all')}
                  >
                    Все локации
                    <span className="badge text-bg-light ms-2">{counts.get('all') || 0}</span>
                  </button>
                  {locations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      className={`btn btn-sm ${
                        String(locationFilter) === String(loc.id)
                          ? 'btn-primary'
                          : 'btn-outline-primary'
                      }`}
                      onClick={() => setLocationFilter(loc.id)}
                    >
                      {loc.name}
                      <span className="badge text-bg-light ms-2">
                        {counts.get(String(loc.id)) || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="text-muted">Подбираем слоты…</div>
              ) : (slots || []).length === 0 ? (
                <div className="alert alert-info mb-0">
                  Свободных слотов отработки пока нет. Свяжитесь с администратором.
                </div>
              ) : filtered.length === 0 ? (
                <div className="alert alert-warning mb-0">
                  В выбранной локации нет свободных слотов. Попробуйте другую.
                </div>
              ) : (
                <div className="d-flex flex-column gap-3">
                  {grouped.map((day) => (
                    <div key={day.key}>
                      <div className="fw-semibold text-capitalize mb-2 border-bottom pb-1">
                        {day.label}
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {day.slots.map((slot) => {
                          const isLoading = Boolean(accepting?.[slot.lesson_id]);
                          return (
                            <button
                              key={slot.lesson_id}
                              type="button"
                              className="btn btn-outline-success text-start"
                              onClick={() => onPick(slot.lesson_id)}
                              disabled={isLoading}
                              style={{ minWidth: 180 }}
                            >
                              <div className="fw-bold">
                                {isLoading ? 'Отправляем…' : formatTime(slot.starts_at)}
                              </div>
                              <small className="d-block">
                                {slot.location_name || '—'}
                              </small>
                              <small className="text-muted">{slot.teacher_name || ''}</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
                </>
              )}
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
