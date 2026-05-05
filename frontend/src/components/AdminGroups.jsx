import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

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
  const [courses, setCourses] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [selectedGroup, setSelectedGroup] = useState(null);

  const [filters, setFilters] = useState({
    query: '',
    status: 'all',
  });

  const [groupForm, setGroupForm] = useState({
    name: '',
    course: '',
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

  const courseMap = useMemo(() => {
    const map = new Map();
    courses.forEach((course) => map.set(course.id, course));
    return map;
  }, [courses]);

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
      const [coursesData, groupsData, usersData] = await Promise.all([
        api.getCourses(),
        api.getGroups(),
        api.getUsers(),
      ]);

      const safeCourses = Array.isArray(coursesData) ? coursesData : [];
      const safeGroups = Array.isArray(groupsData) ? groupsData : [];
      const safeUsers = Array.isArray(usersData) ? usersData : [];

      setCourses(safeCourses);
      setGroups(safeGroups);
      setUsers(safeUsers);

      setGroupForm((prev) => ({
        ...prev,
        course: prev.course || safeCourses[0]?.id || '',
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

      return matchQuery && matchStatus;
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

    if (!groupForm.course) {
      setError('Не удалось создать группу: отсутствует системная настройка.');
      return;
    }

    setSavingGroup(true);
    try {
      await api.createGroup({
        name: groupForm.name.trim(),
        course: Number(groupForm.course),
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
      await loadData();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось создать группу.');
    } finally {
      setSavingGroup(false);
    }
  };

  const resetFilters = () => {
    setFilters({ query: '', status: 'all' });
  };

  return (
    <AdminLayout title="Админ — Группы">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <strong>Создать группу</strong>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateGroup}>
                <div className="mb-3">
                  <label className="form-label">Название группы</label>
                  <input
                    className="form-control"
                    value={groupForm.name}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={loading || savingGroup}
                  />
                </div>

                <SearchableMultiSelect
                  label="Преподаватели"
                  items={teachers}
                  selectedIds={groupForm.teacher_ids}
                  onToggle={(id) => toggleSelection('teacher_ids', id)}
                  loading={loading || savingGroup}
                  placeholder="Выберите преподавателей"
                  emptyText="Преподаватели не найдены"
                  renderLabel={userLabel}
                />

                <SearchableMultiSelect
                  label="Ученики"
                  items={students}
                  selectedIds={groupForm.student_ids}
                  onToggle={(id) => toggleSelection('student_ids', id)}
                  loading={loading || savingGroup}
                  placeholder="Выберите учеников"
                  emptyText="Ученики не найдены"
                  renderLabel={userLabel}
                />

                <div className="form-check mb-3">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={groupForm.is_active}
                    onChange={(event) => setGroupForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                    disabled={loading || savingGroup}
                    id="group-active"
                  />
                  <label className="form-check-label" htmlFor="group-active">
                    Активная группа
                  </label>
                </div>

                <button type="submit" className="btn btn-primary" disabled={loading || savingGroup}>
                  {savingGroup ? 'Сохраняем...' : 'Создать группу'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-8">
          <div className="card mb-3">
            <div className="card-body d-flex flex-wrap gap-2 align-items-center">
              <input
                className="form-control form-control-sm"
                style={{ maxWidth: '280px' }}
                placeholder="Поиск по названию группы"
                value={filters.query}
                onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                disabled={loading}
              />
              <select
                className="form-select form-select-sm"
                style={{ maxWidth: '180px' }}
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                disabled={loading}
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Неактивные</option>
              </select>
              <button className="btn btn-outline-secondary btn-sm" onClick={resetFilters} disabled={loading}>
                Сбросить
              </button>
              <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={loadData} disabled={loading}>
                Обновить
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <strong>Группы</strong>
            </div>
            <div className="card-body p-0">
              {loading ? (
                <div className="p-3">Загрузка...</div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-3 text-muted">Группы не найдены.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-hover mb-0">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Группа</th>
                        <th>Преподавателей</th>
                        <th>Учеников</th>
                        <th>Слот</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGroups.map((group) => (
                        <tr key={group.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedGroup(group)}>
                          <td>{group.id}</td>
                          <td>{group.name}</td>
                          <td>{Array.isArray(group.teachers) ? group.teachers.length : 0}</td>
                          <td>{Array.isArray(group.students) ? group.students.length : 0}</td>
                          <td>{renderGroupSlot(group)}</td>
                          <td>{group.is_active ? 'Активна' : 'Неактивна'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedGroup ? (
        <>
          <div className="modal-backdrop show" onClick={() => setSelectedGroup(null)} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Информация о группе #{selectedGroup.id}</h5>
                  <button type="button" className="btn-close" onClick={() => setSelectedGroup(null)} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div><strong>Название:</strong> {selectedGroup.name}</div>
                      <div><strong>Статус:</strong> {selectedGroup.is_active ? 'Активна' : 'Неактивна'}</div>
                      <div><strong>Слот:</strong> {renderGroupSlot(selectedGroup)}</div>
                    </div>
                    <div className="col-md-6">
                      <div>
                        <strong>Курс (системный):</strong>{' '}
                        {courseMap.get(selectedGroup.course)?.name || `ID ${selectedGroup.course}`}
                      </div>
                      <div><strong>Количество преподавателей:</strong> {Array.isArray(selectedGroup.teachers) ? selectedGroup.teachers.length : 0}</div>
                      <div><strong>Количество учеников:</strong> {Array.isArray(selectedGroup.students) ? selectedGroup.students.length : 0}</div>
                    </div>
                  </div>

                  <hr />

                  <div className="row g-3">
                    <div className="col-md-6">
                      <h6>Преподаватели</h6>
                      {Array.isArray(selectedGroup.teachers) && selectedGroup.teachers.length > 0 ? (
                        <ul className="mb-0">
                          {selectedGroup.teachers.map((teacher) => (
                            <li key={teacher.id}>{userLabel(teacher)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted">Не назначены</div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <h6>Ученики</h6>
                      {Array.isArray(selectedGroup.students) && selectedGroup.students.length > 0 ? (
                        <ul className="mb-0" style={{ maxHeight: '220px', overflow: 'auto' }}>
                          {selectedGroup.students.map((student) => (
                            <li key={student.id}>{userLabel(student)}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted">Не назначены</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setSelectedGroup(null)}>
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
};
