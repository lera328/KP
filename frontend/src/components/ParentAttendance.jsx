import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, parentNavItems } from './AppLayout';
import { MakeupSlotPicker } from './MakeupSlotPicker';

const STATUS_BADGES = {
  present: { label: 'Присутствовал', cls: 'text-bg-success' },
  absent: { label: 'Пропуск', cls: 'text-bg-danger' },
  makeup: { label: 'Отработка', cls: 'text-bg-info' },
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
    month: '2-digit',
    year: 'numeric',
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

  const renderStatusBadge = (status) => {
    const meta = STATUS_BADGES[status] || { label: status, cls: 'text-bg-secondary' };
    return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
  };

  const renderMakeupForAbsence = (record) => {
    const m = makeupByAbsence.get(Number(record.id));
    if (m) {
      return (
        <div className="small">
          <span className="badge text-bg-info me-1">
            {MAKEUP_STATUS_LABELS[m.status] || m.status}
          </span>
          {m.makeup_starts_at ? formatDateTime(m.makeup_starts_at) : '—'}
        </div>
      );
    }
    if (optimisticRequested.has(Number(record.id))) {
      return (
        <span className="badge text-bg-info">Запрос на отработку отправлен</span>
      );
    }
    if (new Date(record.lesson_starts_at) > new Date()) {
      return <span className="text-muted small">Урок ещё не прошёл</span>;
    }
    if (!eligibleAbsenceIds.has(Number(record.id))) {
      return (
        <span className="text-muted small" title="Запись доступна только для трёх последних занятий ребёнка">
          Срок записи на отработку истёк
        </span>
      );
    }
    return (
      <button
        type="button"
        className="btn btn-sm btn-outline-primary"
        onClick={() => handleOpenPicker(record.id)}
      >
        Записаться на отработку
      </button>
    );
  };

  return (
    <AppLayout title="KiberOne — Родитель" navItems={parentNavItems}>
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      {/* Селектор детей */}
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <button
          type="button"
          className={`btn btn-sm ${activeChildId === 'all' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setActiveChildId('all')}
        >
          Все дети
          {totalPending > 0 ? (
            <span className="badge text-bg-warning ms-2">{totalPending}</span>
          ) : null}
        </button>
        {children.map((child) => {
          const pending = pendingByChild.get(child.id) || 0;
          const active = String(activeChildId) === String(child.id);
          return (
            <button
              key={child.id}
              type="button"
              className={`btn btn-sm d-flex align-items-center gap-2 ${
                active ? 'btn-primary' : 'btn-outline-primary'
              }`}
              onClick={() => setActiveChildId(child.id)}
            >
              <span
                className="rounded-circle d-inline-flex align-items-center justify-content-center"
                style={{
                  width: 24,
                  height: 24,
                  background: active ? 'rgba(255,255,255,0.25)' : '#e9ecef',
                  color: active ? '#fff' : '#495057',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {childInitials(child)}
              </span>
              {childName(child)}
              {pending > 0 ? (
                <span className="badge text-bg-warning">{pending}</span>
              ) : null}
            </button>
          );
        })}
        <button
          className="btn btn-sm btn-outline-secondary ms-auto"
          onClick={loadAll}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="card"><div className="card-body">Загрузка…</div></div>
      ) : (
        <>
          {/* KPI */}
          <div className="row g-3 mb-3">
            <div className="col-6 col-md-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Всего занятий</div>
                  <div className="fs-3 fw-bold">{kpi.total}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-success">
                <div className="card-body">
                  <div className="text-muted small">Посещено</div>
                  <div className="fs-3 fw-bold text-success">{kpi.present + kpi.makeup}</div>
                  <div className="small text-muted">из них отработок: {kpi.makeup}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100 border-danger">
                <div className="card-body">
                  <div className="text-muted small">Пропусков</div>
                  <div className="fs-3 fw-bold text-danger">{kpi.absent}</div>
                </div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="card h-100">
                <div className="card-body">
                  <div className="text-muted small">Посещаемость</div>
                  <div className="fs-3 fw-bold">{kpi.rate}%</div>
                  <div className="progress mt-1" style={{ height: 6 }}>
                    <div
                      className={`progress-bar ${
                        kpi.rate >= 80 ? 'bg-success' : kpi.rate >= 50 ? 'bg-warning' : 'bg-danger'
                      }`}
                      style={{ width: `${kpi.rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Требуют внимания */}
          {pendingAbsences.length > 0 ? (
            <div className="card mb-3 border-warning">
              <div className="card-header bg-warning-subtle">
                <strong>⚠ Требуют внимания — пропуски без отработки ({pendingAbsences.length})</strong>
                <div className="text-muted small mt-1">
                  Запись на отработку доступна только для трёх последних занятий ребёнка.
                </div>
              </div>
              <div className="card-body">
                <div className="d-flex flex-column gap-3">
                  {pendingAbsences.map((record) => {
                    const child = childMap.get(record.student_id);
                    return (
                      <div
                        key={record.id}
                        className="d-flex flex-wrap justify-content-between align-items-start gap-3 pb-3 border-bottom"
                      >
                        <div>
                          <div className="fw-semibold">
                            {childName(child)} — {record.group_name || ''}
                          </div>
                          <div className="text-muted small">
                            {formatDate(record.lesson_starts_at)}
                            {record.lesson_topic ? ` · ${record.lesson_topic}` : ''}
                          </div>
                        </div>
                        <div>{renderMakeupForAbsence(record)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {/* Все записи */}
          <div className="card mb-3">
            <div className="card-header">
              <strong>История занятий</strong>
              <span className="text-muted small ms-2">({activeRecords.length})</span>
            </div>
            <div className="card-body p-0">
              {activeRecords.length === 0 ? (
                <div className="p-3 text-muted">Записи посещаемости пока отсутствуют.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 160 }}>Дата</th>
                        {activeChildId === 'all' ? <th>Ребёнок</th> : null}
                        <th>Группа / тема</th>
                        <th style={{ width: 130 }}>Статус</th>
                        <th style={{ width: 70 }}>Оценка</th>
                        <th>ДЗ / комментарий</th>
                        <th style={{ minWidth: 220 }}>Отработка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRecords.map((record) => {
                        const child = childMap.get(record.student_id);
                        return (
                          <tr key={record.id}>
                            <td>{formatDateTime(record.lesson_starts_at)}</td>
                            {activeChildId === 'all' ? (
                              <td className="small">{childName(child) || '-'}</td>
                            ) : null}
                            <td>
                              <div>{record.group_name || '-'}</div>
                              {record.lesson_topic ? (
                                <small className="text-muted">{record.lesson_topic}</small>
                              ) : null}
                            </td>
                            <td>{renderStatusBadge(record.status)}</td>
                            <td>{record.grade != null ? record.grade : '—'}</td>
                            <td className="small" style={{ minWidth: 220 }}>
                              {record.homework ? (
                                <div>
                                  <strong>ДЗ:</strong> {record.homework}
                                </div>
                              ) : null}
                              {record.teacher_comment ? (
                                <div className="text-muted">{record.teacher_comment}</div>
                              ) : null}
                              {!record.homework && !record.teacher_comment ? '—' : null}
                            </td>
                            <td>
                              {record.status === 'absent' ? renderMakeupForAbsence(record) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Сводка по отработкам */}
          {activeMakeups.length > 0 ? (
            <div className="card">
              <div className="card-header">
                <strong>Отработки</strong>
                <span className="text-muted small ms-2">({activeMakeups.length})</span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm mb-0 align-middle">
                    <thead className="table-light">
                      <tr>
                        {activeChildId === 'all' ? <th>Ребёнок</th> : null}
                        <th>Пропущенный урок</th>
                        <th>Слот отработки</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeMakeups.map((item) => {
                        const child = childMap.get(item.student_id);
                        return (
                          <tr key={item.id}>
                            {activeChildId === 'all' ? (
                              <td className="small">{childName(child) || '-'}</td>
                            ) : null}
                            <td>
                              <div>
                                {item.absence_starts_at ? formatDateTime(item.absence_starts_at) : '-'}
                              </div>
                              {item.absence_group_name ? (
                                <small className="text-muted">{item.absence_group_name}</small>
                              ) : null}
                            </td>
                            <td>
                              <div>
                                {item.makeup_starts_at ? formatDateTime(item.makeup_starts_at) : '-'}
                              </div>
                              {item.makeup_group_name ? (
                                <small className="text-muted">{item.makeup_group_name}</small>
                              ) : null}
                            </td>
                            <td>
                              <span className="badge text-bg-info">
                                {MAKEUP_STATUS_LABELS[item.status] || item.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {pickerRecordId !== null ? (
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
      ) : null}
    </AppLayout>
  );
};
