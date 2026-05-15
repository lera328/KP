import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';
import { MakeupSlotPicker } from './MakeupSlotPicker';

const STATUS_META = {
  present: { label: 'Был', color: '#16a34a', bg: '#ecfdf5' },
  absent: { label: 'Пропуск', color: '#dc2626', bg: '#fef2f2' },
  makeup: { label: 'Отработка', color: '#2563eb', bg: '#eff6ff' },
};

const MAKEUP_STATUS_LABELS = {
  requested: 'Запрошена',
  completed: 'Проведена',
  approved: 'Подтверждена',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const childName = (child) => {
  if (!child) return '';
  return `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.username;
};

const childInitials = (child) => {
  if (!child) return '?';
  const first = (child.first_name || child.username || '?')[0] || '?';
  const last = (child.last_name || '')[0] || '';
  return (first + last).toUpperCase();
};

export const ParentAttendance = () => {
  const [children, setChildren] = useState([]);
  const [records, setRecords] = useState([]);
  const [makeups, setMakeups] = useState([]);
  const [activeChildId, setActiveChildId] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [suggestions, setSuggestions] = useState({}); // recordId -> [slots]
  const [pickerRecordId, setPickerRecordId] = useState(null); // recordId, для которого открыт модал
  const [suggestionLoading, setSuggestionLoading] = useState({});
  const [accepting, setAccepting] = useState({});
  // Локально помеченные записи: запрос на отработку только что отправлен,
  // даже если рефетч с сервера ещё не дошёл — чтобы UI не показывал CTA.
  const [optimisticRequested, setOptimisticRequested] = useState(() => new Set());
  const [pickerSuccess, setPickerSuccess] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [childrenData, attendanceData, makeupData] = await Promise.all([
        api.getParentChildren(),
        api.getParentAttendance(''),
        api.getParentMakeups(),
      ]);
      setChildren(Array.isArray(childrenData) ? childrenData : []);
      setRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setMakeups(Array.isArray(makeupData) ? makeupData : []);
      // Сервер вернул актуальные заявки на отработку — оптимистичные пометки больше не нужны
      setOptimisticRequested((prev) => {
        if (prev.size === 0) return prev;
        const serverIds = new Set(
          (Array.isArray(makeupData) ? makeupData : [])
            .map((m) => Number(m.absence_record_id))
            .filter(Boolean),
        );
        const next = new Set();
        for (const id of prev) if (!serverIds.has(id)) next.add(id);
        return next;
      });
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить посещаемость.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const childMap = useMemo(() => new Map(children.map((c) => [c.id, c])), [children]);

  const recordsByChild = useMemo(() => {
    const map = new Map();
    for (const r of records) {
      const arr = map.get(r.student_id) || [];
      arr.push(r);
      map.set(r.student_id, arr);
    }
    return map;
  }, [records]);

  const makeupsByChild = useMemo(() => {
    const map = new Map();
    for (const m of makeups) {
      const arr = map.get(m.student_id) || [];
      arr.push(m);
      map.set(m.student_id, arr);
    }
    return map;
  }, [makeups]);

  const makeupAbsenceIds = useMemo(() => {
    const set = new Set(makeups.map((m) => Number(m.absence_record_id)).filter(Boolean));
    for (const id of optimisticRequested) set.add(Number(id));
    return set;
  }, [makeups, optimisticRequested]);

  // Активный набор данных
  const activeRecords = useMemo(() => {
    const data =
      activeChildId === 'all'
        ? records
        : records.filter((r) => Number(r.student_id) === Number(activeChildId));
    return [...data].sort((a, b) => new Date(b.lesson_starts_at) - new Date(a.lesson_starts_at));
  }, [records, activeChildId]);

  const activeMakeups = useMemo(() => {
    return activeChildId === 'all'
      ? makeups
      : makeups.filter((m) => Number(m.student_id) === Number(activeChildId));
  }, [makeups, activeChildId]);

  // KPI
  const kpi = useMemo(() => {
    const total = activeRecords.length;
    const present = activeRecords.filter((r) => r.status === 'present').length;
    const absent = activeRecords.filter((r) => r.status === 'absent').length;
    const makeup = activeRecords.filter((r) => r.status === 'makeup').length;
    const rate = total > 0 ? Math.round(((present + makeup) / total) * 100) : 0;
    return { total, present, absent, makeup, rate };
  }, [activeRecords]);

  // Eligible (для записи на отработку): пропуск, чей урок входит в 3 последних
  // прошедших занятия ребёнка (любой статус). Это синхронизировано с правилом backend.
  const eligibleAbsenceIds = useMemo(() => {
    const ids = new Set();
    const now = new Date();
    const byChild = new Map();
    // собираем все прошедшие записи по ребёнку
    for (const r of records) {
      if (new Date(r.lesson_starts_at) > now) continue;
      const arr = byChild.get(r.student_id) || [];
      arr.push(r);
      byChild.set(r.student_id, arr);
    }
    for (const arr of byChild.values()) {
      arr.sort((a, b) => new Date(b.lesson_starts_at) - new Date(a.lesson_starts_at));
      // 3 последних занятия ребёнка → их пропуски eligible
      arr.slice(0, 3).forEach((r) => {
        if (r.status === 'absent') ids.add(Number(r.id));
      });
    }
    return ids;
  }, [records]);

  // Пропуски, для которых ещё не подана заявка на отработку (только из числа eligible)
  const pendingAbsences = useMemo(() => {
    const past = activeRecords.filter(
      (r) =>
        r.status === 'absent' &&
        !makeupAbsenceIds.has(Number(r.id)) &&
        new Date(r.lesson_starts_at) <= new Date() &&
        eligibleAbsenceIds.has(Number(r.id)),
    );
    return past.sort((a, b) => new Date(b.lesson_starts_at) - new Date(a.lesson_starts_at));
  }, [activeRecords, makeupAbsenceIds, eligibleAbsenceIds]);

  // Карта record_id -> makeup (если есть)
  const makeupByAbsence = useMemo(() => {
    const map = new Map();
    for (const m of makeups) {
      if (m.absence_record_id) map.set(Number(m.absence_record_id), m);
    }
    return map;
  }, [makeups]);

  // Пропуск-каунт по детям для бейджей в табах (учитываем правило 3 последних)
  const pendingByChild = useMemo(() => {
    const counts = new Map();
    for (const child of children) {
      const recs = recordsByChild.get(child.id) || [];
      const cnt = recs.filter(
        (r) =>
          r.status === 'absent' &&
          !makeupAbsenceIds.has(Number(r.id)) &&
          new Date(r.lesson_starts_at) <= new Date() &&
          eligibleAbsenceIds.has(Number(r.id)),
      ).length;
      counts.set(child.id, cnt);
    }
    return counts;
  }, [children, recordsByChild, makeupAbsenceIds, eligibleAbsenceIds]);

  const totalPending = useMemo(
    () => Array.from(pendingByChild.values()).reduce((a, b) => a + b, 0),
    [pendingByChild],
  );

  const handleOpenPicker = async (recordId) => {
    setPickerRecordId(recordId);
    if (suggestions[recordId] !== undefined) return;
    setSuggestionLoading((p) => ({ ...p, [recordId]: true }));
    setError('');
    setSuccess('');
    try {
      const data = await api.suggestMakeupSlots(recordId);
      setSuggestions((p) => ({ ...p, [recordId]: data?.slots || [] }));
    } catch (e) {
      setError(e.message || 'Не удалось подобрать слоты.');
    } finally {
      setSuggestionLoading((p) => ({ ...p, [recordId]: false }));
    }
  };

  const handleClosePicker = () => {
    setPickerRecordId(null);
    setPickerSuccess('');
  };

  const handleAcceptSlot = async (recordId, lessonId) => {
    const key = `${recordId}:${lessonId}`;
    setAccepting((p) => ({ ...p, [key]: true }));
    setError('');
    setSuccess('');
    setPickerSuccess('');
    try {
      await api.requestMakeup({
        absence_record_id: Number(recordId),
        makeup_lesson_id: Number(lessonId),
      });
      // Оптимистично помечаем — UI сразу скрывает CTA и показывает «Запрос отправлен»
      setOptimisticRequested((prev) => {
        const next = new Set(prev);
        next.add(Number(recordId));
        return next;
      });
      // Сообщение показываем внутри модала; закрытие — по кнопке «Закрыть».
      setPickerSuccess('Заявка на отработку отправлена. Ожидайте подтверждения администратора.');
      setSuggestions((p) => {
        const next = { ...p };
        delete next[recordId];
        return next;
      });
      await loadAll();
    } catch (e) {
      setError(e.message || 'Не удалось отправить заявку на отработку.');
    } finally {
      setAccepting((p) => ({ ...p, [key]: false }));
    }
  };

  const renderMakeupForAbsence = (record) => {
    const m = makeupByAbsence.get(Number(record.id));
    if (m) {
      return (
        <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
          {MAKEUP_STATUS_LABELS[m.status] || m.status}{m.makeup_starts_at ? ` · ${formatDateTime(m.makeup_starts_at)}` : ''}
        </span>
      );
    }
    if (optimisticRequested.has(Number(record.id))) {
      return <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>Запрос отправлен</span>;
    }
    if (new Date(record.lesson_starts_at) > new Date()) {
      return <span className="text-muted small">Урок ещё не прошёл</span>;
    }
    if (!eligibleAbsenceIds.has(Number(record.id))) {
      return <span className="text-muted small">Срок записи истёк</span>;
    }
    return (
      <button
        type="button"
        className="btn btn-sm btn-dark rounded-pill px-3"
        onClick={(e) => { e.stopPropagation(); handleOpenPicker(record.id); }}
      >
        Записать на отработку
      </button>
    );
  };

  return (
    <AppLayout title="KiberOne — Посещаемость" navItems={parentNavItems} kidMode>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>Посещаемость</h1>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 ms-auto"
          onClick={loadAll}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      {/* Селектор детей */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className="btn btn-sm rounded-pill px-3"
          style={{
            background: activeChildId === 'all' ? '#111827' : '#f8f9fb',
            color: activeChildId === 'all' ? '#fff' : '#374151',
            border: `1px solid ${activeChildId === 'all' ? '#111827' : '#e5e7eb'}`,
            fontWeight: 600,
          }}
          onClick={() => setActiveChildId('all')}
        >
          Все дети
          {totalPending > 0 && (
            <span className="badge rounded-pill ms-2" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.65rem' }}>{totalPending}</span>
          )}
        </button>
        {children.map((child) => {
          const pending = pendingByChild.get(child.id) || 0;
          const active = String(activeChildId) === String(child.id);
          return (
            <button
              key={child.id}
              type="button"
              className="btn btn-sm rounded-pill px-3 d-flex align-items-center gap-2"
              style={{
                background: active ? '#111827' : '#f8f9fb',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                fontWeight: 600,
              }}
              onClick={() => setActiveChildId(child.id)}
            >
              <span
                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                style={{ width: 22, height: 22, background: active ? 'rgba(255,255,255,0.2)' : '#eef2ff', color: active ? '#fff' : '#3730a3', fontSize: 10, fontWeight: 700 }}
              >
                {childInitials(child)}
              </span>
              {childName(child)}
              {pending > 0 && (
                <span className="badge rounded-pill" style={{ background: '#fef3c7', color: '#b45309', fontSize: '0.6rem' }}>{pending}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="d-flex flex-column gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="kid-skeleton" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="row g-2 mb-3">
            <KpiTile label="Всего" value={kpi.total} />
            <KpiTile label="Посещено" value={kpi.present + kpi.makeup} accent="#16a34a" sub={kpi.makeup > 0 ? `отработок: ${kpi.makeup}` : null} />
            <KpiTile label="Пропуски" value={kpi.absent} accent="#dc2626" />
            <KpiTile label="Посещаемость" value={`${kpi.rate}%`} accent={kpi.rate >= 80 ? '#16a34a' : kpi.rate >= 50 ? '#d97706' : '#dc2626'} />
          </div>

          {/* Требуют внимания */}
          {pendingAbsences.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 mb-3" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="card-body p-4">
                <div className="fw-semibold mb-1" style={{ color: '#b45309' }}>
                  Требуют внимания — {pendingAbsences.length} пропуск(ов) без отработки
                </div>
                <div className="text-muted small mb-3">Запись доступна для 3 последних занятий ребёнка</div>
                <div className="d-flex flex-column gap-2">
                  {pendingAbsences.map((record) => {
                    const child = childMap.get(record.student_id);
                    return (
                      <div key={record.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 rounded-3 p-3" style={{ background: '#fffbeb' }}>
                        <div>
                          <div className="fw-semibold small">{childName(child)} — {record.group_name || ''}</div>
                          <div className="text-muted small">{formatDate(record.lesson_starts_at)}{record.lesson_topic ? ` · ${record.lesson_topic}` : ''}</div>
                        </div>
                        <div>{renderMakeupForAbsence(record)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* История занятий */}
          <div className="card border-0 shadow-sm rounded-4 mb-3">
            <div className="card-body p-4">
              <div className="fw-semibold mb-3">История занятий <span className="text-muted fw-normal small">({activeRecords.length})</span></div>
              {activeRecords.length === 0 ? (
                <div className="text-muted text-center py-3">Записей пока нет.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {activeRecords.map((record) => {
                    const child = childMap.get(record.student_id);
                    const meta = STATUS_META[record.status] || { label: record.status, color: '#6b7280', bg: '#f3f4f6' };
                    return (
                      <div key={record.id} className="d-flex flex-wrap align-items-center gap-3 rounded-3 p-3" style={{ background: '#f8f9fb', cursor: 'pointer' }} onClick={() => setSelectedRecord(record)}>
                        <div className="flex-shrink-0" style={{ minWidth: 90 }}>
                          <div className="fw-semibold small">{formatDateTime(record.lesson_starts_at)}</div>
                        </div>
                        {activeChildId === 'all' && (
                          <span className="badge rounded-pill" style={{ background: '#eef2ff', color: '#3730a3', fontWeight: 500 }}>{childName(child)}</span>
                        )}
                        <div className="flex-grow-1" style={{ minWidth: 120 }}>
                          <div className="small fw-semibold">{record.group_name || '-'}</div>
                          {record.lesson_topic && <div className="text-muted small">{record.lesson_topic}</div>}
                        </div>
                        <span className="badge rounded-pill" style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
                        {record.grade != null && (
                          <span className="badge rounded-pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>{record.grade}</span>
                        )}
                        {record.status === 'absent' && (
                          <div className="flex-shrink-0">{renderMakeupForAbsence(record)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ДЗ и комментарии — компактный блок */}
          {activeRecords.some((r) => r.homework || r.teacher_comment) && (
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body p-4">
                <div className="fw-semibold mb-3">Домашние задания и комментарии</div>
                <div className="d-flex flex-column gap-2">
                  {activeRecords.filter((r) => r.homework || r.teacher_comment).map((record) => (
                    <div key={`hw-${record.id}`} className="rounded-3 p-3" style={{ background: '#f8f9fb' }}>
                      <div className="d-flex flex-wrap gap-2 align-items-center mb-1">
                        <span className="fw-semibold small">{formatDateTime(record.lesson_starts_at)}</span>
                        <span className="text-muted small">{record.group_name}</span>
                      </div>
                      {record.homework && <div className="small"><strong>ДЗ:</strong> {record.homework}</div>}
                      {record.teacher_comment && <div className="small text-muted">{record.teacher_comment}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Отработки */}
          {activeMakeups.length > 0 && (
            <div className="card border-0 shadow-sm rounded-4 mb-3">
              <div className="card-body p-4">
                <div className="fw-semibold mb-3">Отработки <span className="text-muted fw-normal small">({activeMakeups.length})</span></div>
                <div className="d-flex flex-column gap-2">
                  {activeMakeups.map((item) => {
                    const child = childMap.get(item.student_id);
                    return (
                      <div key={item.id} className="d-flex flex-wrap align-items-center gap-3 rounded-3 p-3" style={{ background: '#f8f9fb' }}>
                        {activeChildId === 'all' && (
                          <span className="badge rounded-pill" style={{ background: '#eef2ff', color: '#3730a3', fontWeight: 500 }}>{childName(child)}</span>
                        )}
                        <div className="flex-grow-1" style={{ minWidth: 140 }}>
                          <div className="small"><strong>Пропуск:</strong> {item.absence_starts_at ? formatDateTime(item.absence_starts_at) : '-'} {item.absence_group_name && `· ${item.absence_group_name}`}</div>
                          <div className="small"><strong>Отработка:</strong> {item.makeup_starts_at ? formatDateTime(item.makeup_starts_at) : '-'} {item.makeup_group_name && `· ${item.makeup_group_name}`}</div>
                        </div>
                        <span className="badge rounded-pill" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}>
                          {MAKEUP_STATUS_LABELS[item.status] || item.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {selectedRecord && (
        <LessonDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      )}

      {pickerRecordId !== null && (
        <MakeupSlotPicker
          absence={records.find((r) => Number(r.id) === Number(pickerRecordId)) || null}
          slots={suggestions[pickerRecordId] || []}
          loading={Boolean(suggestionLoading[pickerRecordId])}
          accepting={Object.fromEntries(
            Object.entries(accepting)
              .filter(([k]) => k.startsWith(`${pickerRecordId}:`))
              .map(([k, v]) => [k.split(':')[1], v]),
          )}
          onPick={(lessonId) => handleAcceptSlot(pickerRecordId, lessonId)}
          onClose={handleClosePicker}
          successMessage={pickerSuccess}
        />
      )}
    </AppLayout>
  );
};

const LessonDetailModal = ({ record, onClose }) => {
  const meta = STATUS_META[record.status] || { label: record.status, color: '#6b7280', bg: '#f3f4f6' };
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <div>
              <div className="text-muted small">{formatDateTime(record.lesson_starts_at)}</div>
              <h5 className="modal-title fw-semibold mb-0">{record.group_name || 'Занятие'}</h5>
            </div>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body pt-0">
            <div className="d-flex flex-wrap gap-2 mb-3">
              <span className="badge rounded-pill" style={{ background: meta.bg, color: meta.color, fontWeight: 500 }}>{meta.label}</span>
              {record.grade != null && (
                <span className="badge rounded-pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>Оценка: {record.grade}</span>
              )}
            </div>
            {record.lesson_topic && (
              <div className="rounded-3 p-3 mb-2" style={{ background: '#f8f9fb' }}>
                <div className="text-muted small">Тема</div>
                <div className="fw-semibold">{record.lesson_topic}</div>
              </div>
            )}
            {record.conducted_description && (
              <div className="rounded-3 p-3 mb-2" style={{ background: '#f8f9fb' }}>
                <div className="text-muted small">Описание урока</div>
                <div>{record.conducted_description}</div>
              </div>
            )}
            {record.homework && (
              <div className="rounded-3 p-3 mb-2" style={{ background: '#eff6ff' }}>
                <div className="text-muted small">Домашнее задание</div>
                <div className="fw-semibold">{record.homework}</div>
              </div>
            )}
            {record.teacher_comment && (
              <div className="rounded-3 p-3 mb-2" style={{ background: '#f8f9fb' }}>
                <div className="text-muted small">Комментарий преподавателя</div>
                <div>{record.teacher_comment}</div>
              </div>
            )}
            {!record.lesson_topic && !record.conducted_description && !record.homework && !record.teacher_comment && (
              <div className="text-muted text-center py-3">Подробности по этому занятию пока не добавлены.</div>
            )}
          </div>
          <div className="modal-footer border-0">
            <button type="button" className="btn btn-light border rounded-pill px-4" onClick={onClose}>Закрыть</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiTile = ({ label, value, accent, sub }) => (
  <div className="col-6 col-md-3">
    <div className="rounded-3 p-3 h-100" style={{ background: '#f8f9fb' }}>
      <div className="text-muted small">{label}</div>
      <div className="fw-semibold" style={{ fontSize: '1.4rem', lineHeight: 1.2, color: accent || '#111827' }}>{value}</div>
      {sub && <div className="text-muted small">{sub}</div>}
    </div>
  </div>
);
