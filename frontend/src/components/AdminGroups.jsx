import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { AdminGroupModal } from './AdminGroupModal';
import { IconPlus, IconRefresh, IconSearch, IconUsers, IconCalendar } from './KidIcons';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const STATUS_PILLS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'inactive', label: 'Архив' },
];

const SearchableMultiSelect = ({
  label,
  items,
  selectedIds,
  onToggle,
  loading,
  placeholder,
  emptyText,
  renderLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) => renderLabel(item).toLowerCase().includes(value));
  }, [items, query, renderLabel]);

  const selectedCount = selectedIds.length;

  return (
    <div className="mb-3 position-relative">
      <label className="form-label d-block">{label}</label>
      <button
        type="button"
        className="form-control text-start d-flex justify-content-between align-items-center"
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
      >
        <span>{selectedCount > 0 ? `Выбрано: ${selectedCount}` : placeholder}</span>
        <span className="text-muted">▾</span>
      </button>

      {open ? (
        <div
          className="border rounded bg-white p-2 mt-1 position-absolute w-100"
          style={{ zIndex: 20, maxHeight: '240px', overflow: 'auto' }}
        >
          <input
            type="text"
            className="form-control form-control-sm mb-2"
            placeholder="Поиск..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={loading}
          />

          {filtered.length === 0 ? (
            <div className="text-muted small px-1 py-2">{emptyText}</div>
          ) : (
            filtered.map((item) => (
              <label className="form-check d-block" key={item.id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggle(item.id)}
                  disabled={loading}
                />
                <span className="form-check-label">{renderLabel(item)}</span>
              </label>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export const AdminGroups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [topics, setTopics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedGroup, setSelectedGroup] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [filters, setFilters] = useState({
    query: '',
    status: 'all',
    location: '',
  });

  const locationMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const [groupForm, setGroupForm] = useState({
    name: '',
    location: '',
    is_active: true,
    teacher_ids: [],
    student_ids: [],
  });

  const teachers = useMemo(
    () => users.filter((item) => Array.isArray(item?.roles) && item.roles.includes('teacher')),
    [users],
  );

  const students = useMemo(
    () => users.filter((item) => Array.isArray(item?.roles) && item.roles.includes('student')),
    [users],
  );

  const userLabel = (item) => {
    if (!item) return '-';
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim();
    return fullName || item.username || `ID ${item.id}`;
  };

  const renderGroupSlot = (group) => {
    if (group.weekly_lesson_weekday === null || !group.weekly_lesson_time) {
      return '-';
    }
    const weekday = WEEKDAY_LABELS[group.weekly_lesson_weekday] || `День #${group.weekly_lesson_weekday}`;
    const time = String(group.weekly_lesson_time).slice(0, 5);
    return `${weekday} ${time}`;
  };

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [groupsData, usersData, locationsData, topicsData] = await Promise.all([
        api.getGroups(),
        api.getUsers(),
        api.getLocations(),
        api.getLessonTopics(),
      ]);

      const safeGroups = Array.isArray(groupsData) ? groupsData : [];
      const safeUsers = Array.isArray(usersData) ? usersData : [];
      const safeLocations = Array.isArray(locationsData) ? locationsData : [];
      const safeTopics = Array.isArray(topicsData) ? topicsData : [];

      setGroups(safeGroups);
      setUsers(safeUsers);
      setLocations(safeLocations);
      setTopics(safeTopics);

      setGroupForm((prev) => ({
        ...prev,
        location: prev.location || safeLocations[0]?.id || '',
      }));
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить данные групп.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredGroups = useMemo(() => {
    return groups.filter((group) => {
      const q = filters.query.trim().toLowerCase();
      const matchQuery = !q || String(group.name || '').toLowerCase().includes(q);

      const matchStatus =
        filters.status === 'all'
          ? true
          : filters.status === 'active'
            ? group.is_active
            : !group.is_active;

      const matchLocation = !filters.location || Number(group.location) === Number(filters.location);

      return matchQuery && matchStatus && matchLocation;
    });
  }, [groups, filters]);

  const toggleSelection = (field, id) => {
    setGroupForm((prev) => {
      const exists = prev[field].includes(id);
      return {
        ...prev,
        [field]: exists ? prev[field].filter((itemId) => itemId !== id) : [...prev[field], id],
      };
    });
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!groupForm.name.trim()) {
      setError('Укажи название группы.');
      return;
    }


    if (!groupForm.location) {
      setError('Выберите локацию группы.');
      return;
    }

    setSavingGroup(true);
    try {
      await api.createGroup({
        name: groupForm.name.trim(),
        location: Number(groupForm.location),
        is_active: groupForm.is_active,
        teacher_ids: groupForm.teacher_ids,
        student_ids: groupForm.student_ids,
      });
      setSuccess('Группа создана.');
      setGroupForm((prev) => ({
        ...prev,
        name: '',
        teacher_ids: [],
        student_ids: [],
      }));
      setCreateOpen(false);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось создать группу.');
    } finally {
      setSavingGroup(false);
    }
  };

  const resetFilters = () => {
    setFilters({ query: '', status: 'all', location: '' });
  };

  return (
    <AdminLayout title="КиберШкола — Группы">
      {error ? <div className="alert alert-danger rounded-3">{error}</div> : null}
      {success ? <div className="alert alert-success rounded-3">{success}</div> : null}

      {/* Header */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <div className="text-muted small">Управление учебными группами</div>
          <h3 className="fw-semibold mb-0">Группы</h3>
        </div>
        <button
          type="button"
          className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={loadData}
          disabled={loading}
        >
          <IconRefresh width={16} height={16} />
          Обновить
        </button>
        <button
          type="button"
          className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
          onClick={() => setCreateOpen(true)}
          disabled={loading}
        >
          <IconPlus width={16} height={16} />
          Создать группу
        </button>
      </div>

      {/* Search + status pills */}
      <div className="card border-0 shadow-sm rounded-4 mb-3">
        <div className="card-body p-3 d-flex flex-wrap align-items-center gap-2">
          <div className="position-relative flex-grow-1" style={{ minWidth: 220 }}>
            <span
              className="position-absolute text-muted"
              style={{ left: 12, top: '50%', transform: 'translateY(-50%)' }}
            >
              <IconSearch width={16} height={16} />
            </span>
            <input
              className="form-control rounded-pill ps-5"
              placeholder="Поиск по названию группы"
              value={filters.query}
              onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
              disabled={loading}
            />
          </div>
          <select
            className="form-select form-select-sm rounded-pill"
            value={filters.location}
            onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
            disabled={loading}
            style={{ minWidth: 140, maxWidth: 180 }}
          >
            <option value="">Все локации</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <div className="d-flex gap-2 flex-wrap">
            {STATUS_PILLS.map((pill) => {
              const active = filters.status === pill.value;
              return (
                <button
                  type="button"
                  key={pill.value}
                  className="btn btn-sm rounded-pill px-3"
                  style={{
                    background: active ? '#111827' : '#f1f3f5',
                    color: active ? '#fff' : '#374151',
                    border: 'none',
                  }}
                  onClick={() => setFilters((prev) => ({ ...prev, status: pill.value }))}
                  disabled={loading}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Group list */}
      {loading ? (
        <div className="text-muted py-4 text-center">Загрузка...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="card-body p-4 text-center text-muted">Группы не найдены.</div>
        </div>
      ) : (
        <div className="row g-3">
          {filteredGroups.map((group) => {
            const teachersCount = Array.isArray(group.teachers) ? group.teachers.length : 0;
            const studentsCount = Array.isArray(group.students) ? group.students.length : 0;
            const slot = renderGroupSlot(group);
            return (
              <div className="col-md-6 col-xl-4" key={group.id}>
                <div
                  role="button"
                  tabIndex={0}
                  className="card border-0 shadow-sm rounded-4 h-100"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/admin/groups/${group.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/admin/groups/${group.id}`);
                    }
                  }}
                >
                  <div className="card-body p-3">
                    <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
                      <div className="flex-grow-1">
                        <div className="fw-semibold" style={{ fontSize: 16 }}>{group.name}</div>
                        <div className="text-muted small">
                          {group.location_name || <span className="text-danger">локация не задана</span>}
                        </div>
                      </div>
                      <span
                        className="badge rounded-pill"
                        style={{
                          background: group.is_active ? '#ecfdf5' : '#f1f3f5',
                          color: group.is_active ? '#16a34a' : '#6b7280',
                          fontWeight: 500,
                        }}
                      >
                        {group.is_active ? 'Активна' : 'Архив'}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-3">
                      <span
                        className="badge rounded-pill d-flex align-items-center gap-1"
                        style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 500 }}
                      >
                        <IconUsers width={12} height={12} />
                        {studentsCount} учеников
                      </span>
                      <span
                        className="badge rounded-pill"
                        style={{ background: '#f5f3ff', color: '#6d28d9', fontWeight: 500 }}
                      >
                        {teachersCount} преп.
                      </span>
                      {slot && slot !== '-' ? (
                        <span
                          className="badge rounded-pill d-flex align-items-center gap-1"
                          style={{ background: '#f8f9fb', color: '#374151', fontWeight: 500 }}
                        >
                          <IconCalendar width={12} height={12} />
                          {slot}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {createOpen ? (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ background: 'rgba(17,24,39,0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-0 px-4 pt-4 pb-2">
                <h5 className="modal-title fw-semibold">Создать группу</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setCreateOpen(false)}
                  disabled={savingGroup}
                />
              </div>
              <form onSubmit={handleCreateGroup}>
                <div className="modal-body px-4 pb-2">
                  <div className="mb-3">
                    <label className="form-label">Название группы</label>
                    <input
                      className="form-control rounded-3"
                      value={groupForm.name}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                      disabled={savingGroup}
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Локация *</label>
                    <select
                      className="form-select rounded-3"
                      value={groupForm.location}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, location: event.target.value }))}
                      disabled={savingGroup}
                    >
                      <option value="">— выберите локацию —</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <SearchableMultiSelect
                    label="Преподаватели"
                    items={teachers}
                    selectedIds={groupForm.teacher_ids}
                    onToggle={(id) => toggleSelection('teacher_ids', id)}
                    loading={savingGroup}
                    placeholder="Выберите преподавателей"
                    emptyText="Преподаватели не найдены"
                    renderLabel={userLabel}
                  />
                  <SearchableMultiSelect
                    label="Ученики"
                    items={students}
                    selectedIds={groupForm.student_ids}
                    onToggle={(id) => toggleSelection('student_ids', id)}
                    loading={savingGroup}
                    placeholder="Выберите учеников"
                    emptyText="Ученики не найдены"
                    renderLabel={userLabel}
                  />
                  <div className="form-check mb-1">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={groupForm.is_active}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      disabled={savingGroup}
                      id="group-active"
                    />
                    <label className="form-check-label" htmlFor="group-active">
                      Активная группа
                    </label>
                  </div>
                </div>
                <div className="modal-footer border-0 px-4 pb-4 pt-2">
                  <button
                    type="button"
                    className="btn btn-light border rounded-pill px-3"
                    onClick={() => setCreateOpen(false)}
                    disabled={savingGroup}
                  >
                    Отмена
                  </button>
                  <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={savingGroup}>
                    {savingGroup ? 'Сохраняем...' : 'Создать'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {selectedGroup ? (
        <AdminGroupModal
          group={selectedGroup}
          locations={locations}
          teachers={teachers}
          students={students}
          topics={topics}
          onClose={() => setSelectedGroup(null)}
          onChanged={async () => {
            await loadData();
            // обновляем выбранную группу свежими данными
            const fresh = await api.getGroups();
            if (Array.isArray(fresh)) {
              const updated = fresh.find((g) => g.id === selectedGroup.id);
              if (updated) setSelectedGroup(updated);
              else setSelectedGroup(null);
            }
          }}
        />
      ) : null}
    </AdminLayout>
  );
};
