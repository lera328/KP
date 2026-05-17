import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AppLayout, teacherNavItems } from './AppLayout';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatRub = (n) =>
  `${Number(n || 0).toLocaleString('ru-RU')} ₽`;

const formatDateTime = (v) =>
  v
    ? new Date(v).toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

const isoDate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
};

const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);

const PRESETS = [
  { key: 'current_month', label: 'Текущий месяц' },
  { key: 'prev_month', label: 'Прошлый месяц' },
  { key: 'current_week', label: 'Эта неделя' },
  { key: 'prev_week', label: 'Прошлая неделя' },
  { key: 'custom', label: 'Свой период' },
];

const computeRange = (preset) => {
  const now = new Date();
  switch (preset) {
    case 'prev_month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: isoDate(startOfMonth(prev)), to: isoDate(endOfMonth(prev)) };
    }
    case 'current_week': {
      const s = startOfWeek(now);
      return { from: isoDate(s), to: isoDate(addDays(s, 6)) };
    }
    case 'prev_week': {
      const s = addDays(startOfWeek(now), -7);
      return { from: isoDate(s), to: isoDate(addDays(s, 6)) };
    }
    case 'current_month':
    default:
      return { from: isoDate(startOfMonth(now)), to: isoDate(endOfMonth(now)) };
  }
};

const formatRangeLabel = (from, to) => {
  if (!from || !to) return '';
  const f = new Date(from);
  const t = new Date(to);
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString('ru-RU', opts)} — ${t.toLocaleDateString('ru-RU', opts)}`;
};

export const TeacherSalary = () => {
  const [preset, setPreset] = useState('current_month');
  const initialRange = useMemo(() => computeRange('current_month'), []);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);

  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [ratePerLesson, setRatePerLesson] = useState(1500);
  const [ratePerMakeup, setRatePerMakeup] = useState(1000);
  const [bonus, setBonus] = useState(0);
  const [penalty, setPenalty] = useState(0);

  const loadLessons = async (from = fromDate, to = toDate) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getTeacherSalary({ from, to });
      setLessons(Array.isArray(data?.lessons) ? data.lessons : []);
      if (Number.isFinite(Number(data?.rate_per_lesson))) {
        setRatePerLesson(Number(data.rate_per_lesson));
      }
      if (Number.isFinite(Number(data?.rate_per_makeup))) {
        setRatePerMakeup(Number(data.rate_per_makeup));
      }
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить уроки для расчёта ЗП.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLessons(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    const r = computeRange(key);
    setFromDate(r.from);
    setToDate(r.to);
    loadLessons(r.from, r.to);
  };

  const handleApplyCustom = () => {
    if (!fromDate || !toDate) return;
    if (new Date(fromDate) > new Date(toDate)) {
      setError('Дата «от» должна быть раньше даты «до».');
      return;
    }
    loadLessons(fromDate, toDate);
  };

  const regularLessons = lessons.filter((l) => !l.is_makeup_slot);
  const makeupLessons = lessons.filter((l) => l.is_makeup_slot);
  const regularCount = regularLessons.length;
  const makeupCount = makeupLessons.length;
  const regularAmount = regularCount * toNumber(ratePerLesson);
  const makeupAmount = makeupCount * toNumber(ratePerMakeup);
  const baseAmount = regularAmount + makeupAmount;
  const totalAmount = baseAmount + toNumber(bonus) - toNumber(penalty);

  return (
    <AppLayout title="КиберШкола" navItems={teacherNavItems} kidMode>
      <div className="mb-4 d-flex flex-wrap align-items-center gap-3">
        <div>
          <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>
            Зарплата
          </h1>
          <div className="text-muted small">{formatRangeLabel(fromDate, toDate)}</div>
        </div>
        <button
          type="button"
          className="ms-auto btn btn-light border rounded-pill px-4"
          onClick={() => loadLessons()}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Выбор периода */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap gap-2 mb-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="btn btn-sm rounded-pill px-3"
                style={{
                  background: preset === p.key ? '#111827' : '#f8f9fb',
                  color: preset === p.key ? '#fff' : '#374151',
                  border: `1px solid ${preset === p.key ? '#111827' : '#e5e7eb'}`,
                  fontWeight: preset === p.key ? 600 : 500,
                }}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="d-flex flex-wrap align-items-end gap-2 mt-2">
              <div>
                <label className="form-label small text-muted mb-1">С</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1">По</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-sm btn-dark rounded-pill px-4"
                onClick={handleApplyCustom}
                disabled={loading}
              >
                Применить
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <SalarySkeleton />
      ) : (
        <>
          {/* Итоговая карточка */}
          <div className="row g-3 mb-3">
            <div className="col-lg-7">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div
                    className="text-muted small text-uppercase mb-2"
                    style={{ letterSpacing: 0.5 }}
                  >
                    Итого к выплате
                  </div>
                  <div className="fw-semibold mb-3" style={{ fontSize: '2.5rem', lineHeight: 1 }}>
                    {formatRub(totalAmount)}
                  </div>

                  <div className="d-flex flex-column gap-2">
                    <BreakdownRow
                      label={`Обычные уроки × ${formatRub(ratePerLesson)}`}
                      value={`${regularCount} × ${ratePerLesson} = ${formatRub(regularAmount)}`}
                    />
                    <BreakdownRow
                      label={`Отработки × ${formatRub(ratePerMakeup)}`}
                      value={`${makeupCount} × ${ratePerMakeup} = ${formatRub(makeupAmount)}`}
                    />
                    {toNumber(bonus) > 0 && (
                      <BreakdownRow
                        label="Премии"
                        value={`+ ${formatRub(toNumber(bonus))}`}
                        positive
                      />
                    )}
                    {toNumber(penalty) > 0 && (
                      <BreakdownRow
                        label="Штрафы"
                        value={`− ${formatRub(toNumber(penalty))}`}
                        negative
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="card border-0 shadow-sm rounded-4 h-100">
                <div className="card-body p-4">
                  <div
                    className="text-muted small text-uppercase mb-3"
                    style={{ letterSpacing: 0.5 }}
                  >
                    Параметры расчёта
                  </div>
                  <FieldNumber
                    label="Ставка за обычный урок"
                    value={ratePerLesson}
                    onChange={setRatePerLesson}
                    suffix="₽"
                  />
                  <FieldNumber
                    label="Ставка за отработку"
                    value={ratePerMakeup}
                    onChange={setRatePerMakeup}
                    suffix="₽"
                  />
                  <FieldNumber
                    label="Премии"
                    value={bonus}
                    onChange={setBonus}
                    suffix="₽"
                  />
                  <FieldNumber
                    label="Штрафы"
                    value={penalty}
                    onChange={setPenalty}
                    suffix="₽"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Список уроков */}
          <div
            className="text-muted small text-uppercase mb-2 d-flex justify-content-between"
            style={{ letterSpacing: 0.5 }}
          >
            <span>Проведённые уроки за период</span>
            <span>{regularCount + makeupCount} шт. (уроки: {regularCount}, отработки: {makeupCount})</span>
          </div>

          {lessons.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body text-center py-5 text-muted">
                Проведённые уроки за выбранный период не найдены.
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-2">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="card border-0 shadow-sm rounded-4"
                >
                  <div className="card-body p-3 d-flex align-items-center gap-3 flex-wrap">
                    <div
                      className="rounded-3 px-3 py-2 fw-semibold flex-shrink-0 text-center"
                      style={{ background: '#f8f9fb', minWidth: 130, fontSize: '0.95rem' }}
                    >
                      {formatDateTime(lesson.starts_at)}
                    </div>
                    <div className="flex-grow-1" style={{ minWidth: 200 }}>
                      <div className="fw-semibold">
                        {lesson.conducted_topic || 'Тема не указана'}
                      </div>
                      <div className="text-muted small d-flex gap-2 align-items-center">
                        {lesson.is_makeup_slot ? (
                          <span className="badge rounded-pill" style={{ background: '#dbeafe', color: '#2563eb', fontWeight: 500, fontSize: '0.65rem' }}>Отработка</span>
                        ) : (
                          <span>Группа #{lesson.group || '—'}</span>
                        )}
                      </div>
                    </div>
                    <div
                      className="fw-semibold text-end"
                      style={{ minWidth: 100 }}
                    >
                      {formatRub(lesson.is_makeup_slot ? ratePerMakeup : ratePerLesson)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
};

const BreakdownRow = ({ label, value, positive, negative }) => (
  <div
    className="d-flex justify-content-between align-items-center rounded-3 p-3"
    style={{ background: '#f8f9fb' }}
  >
    <span className="text-muted small">{label}</span>
    <span
      className="fw-semibold"
      style={{
        color: positive ? '#16a34a' : negative ? '#dc2626' : '#111827',
      }}
    >
      {value}
    </span>
  </div>
);

const FieldNumber = ({ label, value, onChange, suffix }) => (
  <div className="mb-3">
    <label className="form-label small text-muted">{label}</label>
    <div className="input-group">
      <input
        type="number"
        className="form-control rounded-start-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
      />
      {suffix && (
        <span
          className="input-group-text rounded-end-3 border-start-0"
          style={{ background: '#f8f9fb', color: '#6b7280' }}
        >
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const SalarySkeleton = () => (
  <div className="row g-3">
    <div className="col-lg-7">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="kid-skeleton mb-3" style={{ height: 12, width: '40%' }} />
          <div className="kid-skeleton mb-3" style={{ height: 48, width: '50%' }} />
          <div className="kid-skeleton mb-2" style={{ height: 48 }} />
          <div className="kid-skeleton" style={{ height: 48 }} />
        </div>
      </div>
    </div>
    <div className="col-lg-5">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="kid-skeleton mb-3" style={{ height: 12, width: '40%' }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="kid-skeleton mb-3" style={{ height: 38 }} />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default TeacherSalary;
