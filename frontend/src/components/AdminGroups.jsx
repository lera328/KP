import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { AdminGroupModal } from './AdminGroupModal';
import { IconPlus, IconRefresh, IconSearch, IconUsers, IconCalendar } from './KidIcons';
import { SearchableSelect } from './SearchableSelect';

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

  // ── Вкладки ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('groups'); // 'groups' | 'locations'

  // ── Данные групп ────────────────────────────────────────────────────────
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

  // ── Состояние управления локациями ──────────────────────────────────────
  const [locError, setLocError] = useState('');
  const [locSuccess, setLocSuccess] = useState('');
  const [savingLoc, setSavingLoc] = useState(false);

  // Форма создания новой локации
  const [newLocForm, setNewLocForm] = useState({ name: '', address: '' });
  const [createLocOpen, setCreateLocOpen] = useState(false);

  // Инлайн-редактирование существующей локации
  const [editLocId, setEditLocId] = useState(null);
  const [editLocForm, setEditLocForm] = useState({ name: '', address: '' });


  const [filtersState, setFiltersState] = useState({ query: '', status: 'all', location: '' });

  const filters = filtersState;
  const setFilters = setFiltersState;

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

  // ── Обработчики локаций ─────────────────────────────────────────────────

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    if (!newLocForm.name.trim()) {
      setLocError('Введите название локации.');
      return;
    }
    setSavingLoc(true);
    setLocError('');
    setLocSuccess('');
    try {
      await api.createLocation({ name: newLocForm.name.trim(), address: newLocForm.address.trim() });
      setLocSuccess('Локация создана.');
      setNewLocForm({ name: '', address: '' });
      setCreateLocOpen(false);
      const fresh = await api.getLocations();
      setLocations(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLocError(err.message || 'Не удалось создать локацию.');
    } finally {
      setSavingLoc(false);
    }
  };

  const startEditLoc = (loc) => {
    setEditLocId(loc.id);
    setEditLocForm({ name: loc.name, address: loc.address || '' });
    setLocError('');
    setLocSuccess('');
  };

  const cancelEditLoc = () => {
    setEditLocId(null);
    setEditLocForm({ name: '', address: '' });
  };

  const handleSaveEditLoc = async (locId) => {
    if (!editLocForm.name.trim()) {
      setLocError('Название не может быть пустым.');
      return;
    }
    setSavingLoc(true);
    setLocError('');
    setLocSuccess('');
    try {
      await api.updateLocation(locId, { name: editLocForm.name.trim(), address: editLocForm.address.trim() });
      setLocSuccess('Локация обновлена.');
      setEditLocId(null);
      const fresh = await api.getLocations();
      setLocations(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLocError(err.message || 'Не удалось сохранить изменения.');
    } finally {
      setSavingLoc(false);
    }
  };

  const handleToggleLocActive = async (loc) => {
    setSavingLoc(true);
    setLocError('');
    setLocSuccess('');
    try {
      await api.updateLocation(loc.id, { is_active: !loc.is_active });
      setLocSuccess(loc.is_active ? 'Локация деактивирована.' : 'Локация активирована.');
      const fresh = await api.getLocations();
      setLocations(Array.isArray(fresh) ? fresh : []);
    } catch (err) {
      setLocError(err.message || 'Не удалось изменить статус локации.');
    } finally {
      setSavingLoc(false);
    }
  };

  return (
    <AdminLayout title="КиберШкола — Группы">
      {/* ── Переключатель вкладок ── */}
      <div className="d-flex gap-2 mb-4">
        {[
          { key: 'groups', label: '📋 Группы' },
          { key: 'locations', label: '📍 Локации' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            id={`tab-${tab.key}`}
            className="btn rounded-pill px-4"
            style={{
              background: activeTab === tab.key ? '#111827' : '#f1f3f5',
              color: activeTab === tab.key ? '#fff' : '#374151',
              fontWeight: activeTab === tab.key ? 600 : 400,
              border: 'none',
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={() => {
              setActiveTab(tab.key);
              setError('');
              setSuccess('');
              setLocError('');
              setLocSuccess('');
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ ВКЛАДКА: ГРУППЫ ══════════════════ */}
      {activeTab === 'groups' && (
        <>

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
          <div style={{ minWidth: 160, maxWidth: 200 }}>
            <SearchableSelect
              size="sm"
              options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
              value={filters.location}
              onChange={(v) => setFilters((prev) => ({ ...prev, location: v }))}
              disabled={loading}
              allowClear
              clearLabel="Все локации"
              placeholder="Все локации"
            />
          </div>
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
                    <SearchableSelect
                      options={locations.map((loc) => ({ value: loc.id, label: loc.name }))}
                      value={groupForm.location}
                      onChange={(v) => setGroupForm((prev) => ({ ...prev, location: v }))}
                      disabled={savingGroup}
                      placeholder="— выберите локацию —"
                    />
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
        </>
      )}

      {/* ══════════════════ ВКЛАДКА: ЛОКАЦИИ ══════════════════ */}
      {activeTab === 'locations' && (
        <>
          {locError ? <div className="alert alert-danger rounded-3">{locError}</div> : null}
          {locSuccess ? <div className="alert alert-success rounded-3">{locSuccess}</div> : null}

          {/* Заголовок */}
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <div className="flex-grow-1">
              <div className="text-muted small">Точки присутствия КиберШколы</div>
              <h3 className="fw-semibold mb-0">Локации</h3>
            </div>
            <div className="d-flex gap-2 flex-shrink-0">
              <button
                type="button"
                id="btn-refresh-locations"
                className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
                onClick={async () => {
                  const fresh = await api.getLocations();
                  setLocations(Array.isArray(fresh) ? fresh : []);
                }}
                disabled={savingLoc}
              >
                <IconRefresh width={16} height={16} />
                <span className="d-none d-sm-inline">Обновить</span>
              </button>
              <button
                type="button"
                id="btn-create-location"
                className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
                onClick={() => {
                  setCreateLocOpen(true);
                  setLocError('');
                  setLocSuccess('');
                }}
                disabled={savingLoc}
              >
                <IconPlus width={16} height={16} />
                <span>Добавить локацию</span>
              </button>
            </div>
          </div>

          {/* Список локаций */}
          {loading ? (
            <div className="text-muted py-4 text-center">Загрузка...</div>
          ) : locations.length === 0 ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4 text-center text-muted">Локации не найдены.</div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="card border-0 shadow-sm rounded-4"
                  style={{ opacity: loc.is_active ? 1 : 0.6 }}
                >
                  <div className="card-body p-3">
                    {editLocId === loc.id ? (
                      /* ── режим редактирования ── */
                      <div className="d-flex flex-column gap-2">
                        <input
                          id={`loc-edit-name-${loc.id}`}
                          className="form-control form-control-sm rounded-3"
                          placeholder="Название"
                          value={editLocForm.name}
                          onChange={(e) => setEditLocForm((p) => ({ ...p, name: e.target.value }))}
                          disabled={savingLoc}
                          autoFocus
                        />
                        <input
                          id={`loc-edit-address-${loc.id}`}
                          className="form-control form-control-sm rounded-3"
                          placeholder="Адрес (необязательно)"
                          value={editLocForm.address}
                          onChange={(e) => setEditLocForm((p) => ({ ...p, address: e.target.value }))}
                          disabled={savingLoc}
                        />
                        <div className="d-flex gap-2 mt-1">
                          <button
                            type="button"
                            id={`btn-save-loc-${loc.id}`}
                            className="btn btn-sm btn-dark rounded-pill px-3"
                            onClick={() => handleSaveEditLoc(loc.id)}
                            disabled={savingLoc}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-light border rounded-pill px-3"
                            onClick={cancelEditLoc}
                            disabled={savingLoc}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── режим просмотра ── */
                      <div className="d-flex align-items-start gap-3">
                        <div className="flex-grow-1 min-width-0">
                          <div className="fw-semibold" style={{ fontSize: 15 }}>{loc.name}</div>
                          <div className="text-muted small mt-1">
                            {loc.address || <span className="fst-italic">адрес не указан</span>}
                          </div>
                        </div>
                        <div className="d-flex flex-column flex-sm-row align-items-end align-items-sm-center gap-2 flex-shrink-0">
                          <span
                            className="badge rounded-pill"
                            style={{
                              background: loc.is_active ? '#ecfdf5' : '#f1f3f5',
                              color: loc.is_active ? '#16a34a' : '#6b7280',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {loc.is_active ? 'Активна' : 'Неактивна'}
                          </span>
                          <button
                            type="button"
                            id={`btn-edit-loc-${loc.id}`}
                            className="btn btn-sm btn-light border rounded-pill px-3"
                            onClick={() => startEditLoc(loc)}
                            disabled={savingLoc}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            id={`btn-toggle-loc-${loc.id}`}
                            className={`btn btn-sm rounded-pill px-3 ${
                              loc.is_active ? 'btn-outline-danger' : 'btn-outline-success'
                            }`}
                            onClick={() => handleToggleLocActive(loc)}
                            disabled={savingLoc}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {loc.is_active ? 'Деактивировать' : 'Активировать'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Модальное окно создания локации */}
          {createLocOpen ? (
            <div
              className="modal fade show d-block"
              tabIndex={-1}
              style={{ background: 'rgba(17,24,39,0.5)' }}
              onClick={(e) => { if (e.target === e.currentTarget) setCreateLocOpen(false); }}
            >
              <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content border-0 rounded-4 shadow">
                  <div className="modal-header border-0 px-4 pt-4 pb-2">
                    <h5 className="modal-title fw-semibold">Новая локация</h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => setCreateLocOpen(false)}
                      disabled={savingLoc}
                    />
                  </div>
                  <form onSubmit={handleCreateLocation}>
                    <div className="modal-body px-4 pb-2">
                      <div className="mb-3">
                        <label className="form-label" htmlFor="loc-new-name">Название *</label>
                        <input
                          id="loc-new-name"
                          className="form-control rounded-3"
                          placeholder="Например: ул. Куйбышева"
                          value={newLocForm.name}
                          onChange={(e) => setNewLocForm((p) => ({ ...p, name: e.target.value }))}
                          disabled={savingLoc}
                          autoFocus
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label" htmlFor="loc-new-address">Адрес</label>
                        <input
                          id="loc-new-address"
                          className="form-control rounded-3"
                          placeholder="Полный адрес (необязательно)"
                          value={newLocForm.address}
                          onChange={(e) => setNewLocForm((p) => ({ ...p, address: e.target.value }))}
                          disabled={savingLoc}
                        />
                      </div>
                    </div>
                    <div className="modal-footer border-0 px-4 pb-4 pt-2">
                      <button
                        type="button"
                        className="btn btn-light border rounded-pill px-3"
                        onClick={() => setCreateLocOpen(false)}
                        disabled={savingLoc}
                      >
                        Отмена
                      </button>
                      <button
                        type="submit"
                        id="btn-save-new-location"
                        className="btn btn-dark rounded-pill px-4"
                        disabled={savingLoc}
                      >
                        {savingLoc ? 'Сохраняем...' : 'Создать'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </AdminLayout>
  );
};
