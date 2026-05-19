import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { useAuth } from '../context/AuthContext';
import { IconPlus, IconRefresh, IconSearch } from './KidIcons';

const SearchableMultiSelect = ({ label, items, selectedIds, onToggle, loading, placeholder, emptyText, renderLabel }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const v = query.trim().toLowerCase();
    if (!v) return items;
    return items.filter((item) => renderLabel(item).toLowerCase().includes(v));
  }, [items, query, renderLabel]);
  return (
    <div className="mb-3 position-relative">
      <label className="form-label d-block">{label}</label>
      <button type="button" className="form-control text-start d-flex justify-content-between align-items-center" onClick={() => setOpen((p) => !p)} disabled={loading}>
        <span>{selectedIds.length > 0 ? `Выбрано: ${selectedIds.length}` : placeholder}</span>
        <span className="text-muted">▾</span>
      </button>
      {open && (
        <div className="border rounded bg-white p-2 mt-1 position-absolute w-100 shadow-sm" style={{ zIndex: 20, maxHeight: '220px', overflow: 'auto' }}>
          <input type="text" className="form-control form-control-sm mb-2" placeholder="Поиск..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {filtered.length === 0 ? (
            <div className="text-muted small px-1 py-2">{emptyText}</div>
          ) : filtered.map((item) => (
            <label className="form-check d-block" key={item.id}>
              <input className="form-check-input" type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => onToggle(item.id)} disabled={loading} />
              <span className="form-check-label">{renderLabel(item)}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

const ROLE_BADGE = {
  admin: { bg: '#fef3c7', color: '#b45309' },
  teacher: { bg: '#eff6ff', color: '#1d4ed8' },
  parent: { bg: '#f5f3ff', color: '#6d28d9' },
  student: { bg: '#ecfdf5', color: '#16a34a' },
};

const getInitials = (u) => {
  const fn = (u?.first_name || '').trim();
  const ln = (u?.last_name || '').trim();
  if (fn || ln) {
    return `${fn[0] || ''}${ln[0] || ''}`.toUpperCase() || '?';
  }
  return (u?.username || '?').slice(0, 2).toUpperCase();
};

const ROLE_OPTIONS = [
  { code: 'admin', label: 'Администратор' },
  { code: 'teacher', label: 'Преподаватель' },
  { code: 'parent', label: 'Родитель' },
  { code: 'student', label: 'Ученик' },
];

const USER_CATEGORIES = [
  { key: 'admins', title: 'Администраторы' },
  { key: 'teachers', title: 'Преподаватели' },
  { key: 'parents', title: 'Родители' },
  { key: 'students', title: 'Ученики' },
];

const CREATE_FORM_INITIAL = {
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  telegram_chat_id: '',
  role: 'student',
  group_id: '',
  child_ids: [],
  parent_id: '',
};

const EDIT_FORM_INITIAL = {
  username: '',
  password: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  telegram_chat_id: '',
  role: '',
  group_id: '',
  child_ids: [],
  parent_id: '',
};

export const AdminUsers = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState(CREATE_FORM_INITIAL);
  const [savingCreate, setSavingCreate] = useState(false);

  const [viewingUser, setViewingUser] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(EDIT_FORM_INITIAL);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deletingUserId, setDeletingUserId] = useState(null);
  const [resettingUserId, setResettingUserId] = useState(null);
  const [generatedPassword, setGeneratedPassword] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeCategory, setActiveCategory] = useState('admins');
  const [searchByCategory, setSearchByCategory] = useState({
    admins: '',
    teachers: '',
    parents: '',
    students: '',
  });

  const roleMap = useMemo(
    () => ROLE_OPTIONS.reduce((acc, role) => ({ ...acc, [role.code]: role.label }), {}),
    [],
  );

  const isRole = (userItem, roleCode) => Array.isArray(userItem?.roles) && userItem.roles.includes(roleCode);

  const categorizedUsers = useMemo(
    () => ({
      admins: users.filter((userItem) => userItem?.is_superuser || isRole(userItem, 'admin')),
      teachers: users.filter((userItem) => isRole(userItem, 'teacher')),
      parents: users.filter((userItem) => isRole(userItem, 'parent')),
      students: users.filter((userItem) => isRole(userItem, 'student')),
    }),
    [users],
  );

  const studentUsers = useMemo(
    () => users.filter((u) => isRole(u, 'student')),
    [users],
  );

  const parentUsers = useMemo(
    () => users.filter((u) => isRole(u, 'parent')),
    [users],
  );

  const userMatchesSearch = (userItem, searchValue) => {
    const query = String(searchValue || '').trim().toLowerCase();
    if (!query) return true;

    const fullName = `${userItem.first_name || ''} ${userItem.last_name || ''}`.trim().toLowerCase();
    const username = String(userItem.username || '').toLowerCase();
    const email = String(userItem.email || '').toLowerCase();

    return fullName.includes(query) || username.includes(query) || email.includes(query);
  };

  const activeSearch = searchByCategory[activeCategory] || '';

  const visibleUsers = useMemo(
    () => (categorizedUsers[activeCategory] || []).filter((userItem) => userMatchesSearch(userItem, activeSearch)),
    [categorizedUsers, activeCategory, activeSearch],
  );

  const viewingUserGroups = useMemo(() => {
    if (!viewingUser) {
      return [];
    }
    return groups.filter(
      (group) => Array.isArray(group.students) && group.students.some((item) => item.id === viewingUser.id),
    );
  }, [viewingUser, groups]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const [usersData, groupsData] = await Promise.all([api.getUsers(), api.getGroups()]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить пользователей.');
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCategorySearchChange = (value) => {
    setSearchByCategory((prev) => ({ ...prev, [activeCategory]: value }));
  };

  const openCreateModal = () => {
    setCreateForm(CREATE_FORM_INITIAL);
    setCreateModalOpen(true);
    setError('');
    setSuccess('');
  };

  const closeCreateModal = () => {
    if (!savingCreate) {
      setCreateModalOpen(false);
    }
  };

  const openViewUser = (targetUser) => {
    setViewingUser(targetUser);
  };

  const closeViewUser = () => {
    setViewingUser(null);
  };

  const updateCreateField = (event) => {
    const { name, value } = event.target;
    setCreateForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'role' && value !== 'student') {
        next.group_id = '';
      }
      return next;
    });
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!createForm.username.trim() || !createForm.password.trim()) {
      setError('Заполните имя пользователя и пароль.');
      return;
    }

    if (!createForm.role) {
      setError('Выберите роль пользователя.');
      return;
    }


    setSavingCreate(true);
    try {
      await api.createUser({
        ...createForm,
        username: createForm.username.trim(),
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim(),
        telegram_chat_id: createForm.telegram_chat_id.trim(),
        roles: [createForm.role],
        group_ids: createForm.role === 'student' && createForm.group_id ? [Number(createForm.group_id)] : [],
        child_ids: createForm.role === 'parent' ? createForm.child_ids : [],
        parent_id: createForm.role === 'student' && createForm.parent_id ? Number(createForm.parent_id) : null,
      });

      setSuccess('Пользователь успешно создан.');
      setCreateModalOpen(false);
      setCreateForm(CREATE_FORM_INITIAL);
      await loadUsers();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось создать пользователя.');
    } finally {
      setSavingCreate(false);
    }
  };

  const openEditUser = (targetUser) => {
    const roleCode = Array.isArray(targetUser.roles) && targetUser.roles.length > 0 ? targetUser.roles[0] : '';
    const studentGroupIds = groups
      .filter((group) => Array.isArray(group.students) && group.students.some((item) => item.id === targetUser.id))
      .map((group) => group.id);

    setEditForm({
      username: targetUser.username || '',
      password: '',
      first_name: targetUser.first_name || '',
      last_name: targetUser.last_name || '',
      email: targetUser.email || '',
      phone: targetUser.phone || '',
      telegram_chat_id: targetUser.telegram_chat_id || '',
      role: roleCode,
      group_id: studentGroupIds[0] ? String(studentGroupIds[0]) : '',
      child_ids: Array.isArray(targetUser.children) ? targetUser.children : [],
      parent_id: targetUser.parent_id ? String(targetUser.parent_id) : '',
    });
    setEditingUser(targetUser);
    setError('');
    setSuccess('');
  };

  const closeEditUser = () => {
    if (!savingEdit) {
      setEditingUser(null);
      setEditForm(EDIT_FORM_INITIAL);
    }
  };

  const isEditingSelf = Boolean(editingUser && currentUser?.id === editingUser.id);

  const updateEditField = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'role' && value !== 'student') {
        next.group_id = '';
      }
      return next;
    });
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    setError('');
    setSuccess('');

    if (!editForm.username.trim()) {
      setError('Имя пользователя не может быть пустым.');
      return;
    }

    if (!editForm.role) {
      setError('Роль пользователя обязательна.');
      return;
    }


    setSavingEdit(true);
    try {
      const payload = {
        username: editForm.username.trim(),
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim(),
        telegram_chat_id: editForm.telegram_chat_id.trim(),
        roles: [editForm.role],
        group_ids: editForm.role === 'student' && editForm.group_id ? [Number(editForm.group_id)] : [],
        child_ids: editForm.role === 'parent' ? editForm.child_ids : [],
        parent_id: editForm.role === 'student' ? (editForm.parent_id ? Number(editForm.parent_id) : 0) : null,
      };

      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      await api.updateUser(editingUser.id, payload);
      setSuccess('Пользователь обновлён.');
      setEditingUser(null);
      setEditForm(EDIT_FORM_INITIAL);
      await loadUsers();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось обновить пользователя.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async (targetUser) => {
    const confirmed = window.confirm(
      `Сгенерировать одноразовый пароль для ${targetUser.username || targetUser.id}?\n\n` +
        'Старый пароль перестанет работать. При следующем входе пользователь обязан будет сменить пароль.',
    );
    if (!confirmed) return;

    setError('');
    setSuccess('');
    setResettingUserId(targetUser.id);
    try {
      const response = await api.adminResetUserPassword(targetUser.id);
      setGeneratedPassword({
        username: response?.username || targetUser.username,
        password: response?.one_time_password,
      });
      setSuccess('Одноразовый пароль выдан. Передайте его пользователю.');
    } catch (resetError) {
      setError(resetError.message || 'Не удалось сбросить пароль.');
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const confirmed = window.confirm(
      `Удалить пользователя ${targetUser.username || targetUser.id}?\n\n` +
        'Внимание: у пользователя могут быть связанные данные (группы, посещаемость, пакеты занятий, платежи, расписание).\n' +
        'Удаление может затронуть эти данные.',
    );
    if (!confirmed) {
      return;
    }

    setError('');
    setSuccess('');
    setDeletingUserId(targetUser.id);
    try {
      await api.deleteUser(targetUser.id);
      setSuccess('Пользователь удалён.');
      await loadUsers();
    } catch (deleteError) {
      setError(deleteError.message || 'Не удалось удалить пользователя.');
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <AdminLayout title="КиберШкола — Пользователи">
      {error ? <div className="alert alert-danger rounded-3">{error}</div> : null}
      {success ? <div className="alert alert-success rounded-3">{success}</div> : null}

      {generatedPassword ? (
        <div
          className="rounded-4 p-3 mb-3 d-flex align-items-start justify-content-between flex-wrap gap-3"
          style={{ background: '#fef3c7', border: '1px solid #fde68a' }}
        >
          <div>
            <div style={{ color: '#92400e' }}>
              <strong>Одноразовый пароль для {generatedPassword.username}:</strong>{' '}
              <code
                className="rounded-2 px-2 py-1"
                style={{
                  background: '#fff',
                  color: '#92400e',
                  fontSize: '1rem',
                  fontWeight: 600,
                }}
              >
                {generatedPassword.password}
              </code>
            </div>
            <div className="small mt-1" style={{ color: '#92400e' }}>
              Передайте пароль пользователю. При входе он будет обязан задать новый.
            </div>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-light border rounded-pill px-3"
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(generatedPassword.password || '');
                }
              }}
            >
              Скопировать
            </button>
            <button
              type="button"
              className="btn btn-sm btn-dark rounded-pill px-3"
              onClick={() => setGeneratedPassword(null)}
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}

      {/* Шапка */}
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div className="flex-grow-1">
          <h3 className="fw-semibold mb-0">Пользователи</h3>
          <div className="text-muted small">
            Управление учётными записями по категориям
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-light border rounded-pill px-3 d-flex align-items-center gap-2"
            onClick={loadUsers}
            disabled={loadingUsers}
            title="Обновить"
          >
            <IconRefresh width={16} height={16} />
            <span className="d-none d-md-inline">Обновить</span>
          </button>
          <button
            type="button"
            className="btn btn-dark rounded-pill px-3 d-flex align-items-center gap-2"
            onClick={openCreateModal}
          >
            <IconPlus width={16} height={16} />
            Добавить пользователя
          </button>
        </div>
      </div>

      {/* Категории */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {USER_CATEGORIES.map((category) => {
          const count = (categorizedUsers[category.key] || []).length;
          const active = activeCategory === category.key;
          return (
            <button
              key={category.key}
              type="button"
              className="btn btn-sm rounded-pill px-3 d-flex align-items-center gap-2"
              style={{
                background: active ? '#111827' : '#f8f9fb',
                color: active ? '#fff' : '#374151',
                border: `1px solid ${active ? '#111827' : '#e5e7eb'}`,
                fontWeight: active ? 600 : 500,
              }}
              onClick={() => setActiveCategory(category.key)}
            >
              <span>{category.title}</span>
              <span
                className="badge rounded-pill"
                style={{
                  background: active ? 'rgba(255,255,255,0.2)' : '#e5e7eb',
                  color: active ? '#fff' : '#374151',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Поиск */}
      <div
        className="d-flex align-items-center gap-2 rounded-3 mb-3 px-3"
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          height: 44,
        }}
      >
        <IconSearch width={18} height={18} style={{ color: '#9ca3af' }} />
        <input
          type="text"
          className="form-control border-0 shadow-none px-0"
          placeholder="Поиск: логин, имя, email"
          value={activeSearch}
          onChange={(event) => handleCategorySearchChange(event.target.value)}
          style={{ background: 'transparent' }}
        />
        {activeSearch && (
          <button
            type="button"
            className="btn btn-sm btn-link text-muted text-decoration-none p-0"
            onClick={() => handleCategorySearchChange('')}
          >
            Очистить
          </button>
        )}
      </div>

      {/* Список */}
      {loadingUsers ? (
        <div className="text-center py-5 text-muted">Загрузка…</div>
      ) : visibleUsers.length === 0 ? (
        <div
          className="rounded-4 p-4 text-center text-muted"
          style={{ background: '#f8f9fb' }}
        >
          Пользователи не найдены.
        </div>
      ) : (
        <div className="d-flex flex-column gap-2">
          {visibleUsers.map((row) => {
            const displayName =
              `${row.first_name || ''} ${row.last_name || ''}`.trim() ||
              row.username ||
              `ID ${row.id}`;
            const roleCode = row.is_superuser
              ? 'admin'
              : Array.isArray(row.roles) && row.roles.length > 0
              ? row.roles[0]
              : '';
            const roleLabel = row.is_superuser
              ? 'Суперпользователь'
              : roleMap[roleCode] || '—';
            const roleBadge = ROLE_BADGE[roleCode] || {
              bg: '#f3f4f6',
              color: '#6b7280',
            };
            const isCurrentUser = currentUser?.id === row.id;
            const isDeleting = deletingUserId === row.id;
            const isResetting = resettingUserId === row.id;
            const hasDebt = roleCode === 'student' && row.balance !== null && row.balance !== undefined && row.balance < 0;

            return (
              <div
                key={row.id}
                className="card border-0 shadow-sm rounded-4"
                style={{ cursor: 'pointer', border: hasDebt ? '2px solid #ef4444' : undefined, background: hasDebt ? '#fef2f2' : undefined }}
                onClick={() => openViewUser(row)}
              >
                <div className="card-body p-3 d-flex flex-wrap align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                    style={{
                      width: 44,
                      height: 44,
                      background: hasDebt ? '#fee2e2' : roleBadge.bg,
                      color: hasDebt ? '#dc2626' : roleBadge.color,
                      fontSize: '0.95rem',
                    }}
                  >
                    {getInitials(row)}
                  </div>
                  <div className="flex-grow-1" style={{ minWidth: 200 }}>
                    <div className="fw-semibold" style={{ color: hasDebt ? '#dc2626' : undefined }}>{displayName}</div>
                    <div className="text-muted small">
                      {row.username ? `@${row.username}` : `ID ${row.id}`}
                      {row.email ? ` · ${row.email}` : ''}
                    </div>
                  </div>
                  {hasDebt && (
                    <span className="badge rounded-pill" style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 600, fontSize: '0.78rem' }}>
                      Баланс: {row.balance}
                    </span>
                  )}
                  <span
                    className="badge rounded-pill"
                    style={{
                      background: roleBadge.bg,
                      color: roleBadge.color,
                      fontWeight: 500,
                      fontSize: '0.78rem',
                    }}
                  >
                    {roleLabel}
                  </span>
                  <div className="d-flex gap-1 flex-shrink-0">
                    <button
                      type="button"
                      className="btn btn-sm btn-light border rounded-pill px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditUser(row);
                      }}
                      disabled={isDeleting || isResetting}
                    >
                      Изменить
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light border rounded-pill px-3"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleResetPassword(row);
                      }}
                      disabled={isCurrentUser || isDeleting || isResetting}
                      title="Сбросить пароль"
                    >
                      {isResetting ? '…' : 'Пароль'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm rounded-pill px-3"
                      style={{
                        background: '#fef2f2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteUser(row);
                      }}
                      disabled={isCurrentUser || isDeleting || isResetting}
                    >
                      {isDeleting ? '…' : 'Удалить'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewingUser ? (
        <>
          <div className="modal-backdrop show" onClick={closeViewUser} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow-lg">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Профиль пользователя</h5>
                  <button type="button" className="btn-close" onClick={closeViewUser} />
                </div>
                <div className="modal-body pt-0">
                  {/* Шапка профиля */}
                  <div
                    className="rounded-4 p-3 mb-3 d-flex align-items-center gap-3"
                    style={{ background: '#f8f9fb' }}
                  >
                    {(() => {
                      const roleCode = viewingUser.is_superuser
                        ? 'admin'
                        : Array.isArray(viewingUser.roles) && viewingUser.roles.length > 0
                        ? viewingUser.roles[0]
                        : '';
                      const badge = ROLE_BADGE[roleCode] || {
                        bg: '#f3f4f6',
                        color: '#6b7280',
                      };
                      const roleLabel = viewingUser.is_superuser
                        ? 'Суперпользователь'
                        : roleMap[roleCode] || '—';
                      return (
                        <>
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
                            style={{
                              width: 56,
                              height: 56,
                              background: badge.bg,
                              color: badge.color,
                              fontSize: '1.1rem',
                            }}
                          >
                            {getInitials(viewingUser)}
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-semibold" style={{ fontSize: '1.05rem' }}>
                              {`${viewingUser.first_name || ''} ${viewingUser.last_name || ''}`.trim() ||
                                viewingUser.username ||
                                `ID ${viewingUser.id}`}
                            </div>
                            <div className="text-muted small">
                              {viewingUser.username ? `@${viewingUser.username}` : `ID ${viewingUser.id}`}
                            </div>
                          </div>
                          <span
                            className="badge rounded-pill"
                            style={{
                              background: badge.bg,
                              color: badge.color,
                              fontWeight: 500,
                              fontSize: '0.85rem',
                            }}
                          >
                            {roleLabel}
                          </span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="row g-2">
                    <InfoField label="Эл. почта" value={viewingUser.email} />
                    <InfoField label="Телефон" value={viewingUser.phone} />
                    <InfoField label="Telegram ID" value={viewingUser.telegram_chat_id} />
                    <InfoField
                      label="Группа ученика"
                      value={
                        viewingUserGroups.length > 0
                          ? viewingUserGroups.map((group) => group.name).join(', ')
                          : (Array.isArray(viewingUser.roles) && viewingUser.roles[0] === 'student'
                              ? 'Не назначена'
                              : null)
                      }
                    />
                  </div>
                </div>
                <div className="modal-footer border-0">
                  <button type="button" className="btn btn-light border rounded-pill px-4" onClick={closeViewUser}>
                    Закрыть
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {createModalOpen ? (
        <>
          <div className="modal-backdrop show" onClick={closeCreateModal} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow-lg">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Создать пользователя</h5>
                  <button type="button" className="btn-close" onClick={closeCreateModal} disabled={savingCreate} />
                </div>
                <form onSubmit={handleCreateSubmit}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Имя пользователя *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="username"
                        value={createForm.username}
                        onChange={updateCreateField}
                        disabled={savingCreate}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Пароль *</label>
                      <input
                        type="password"
                        className="form-control"
                        name="password"
                        value={createForm.password}
                        onChange={updateCreateField}
                        disabled={savingCreate}
                        required
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Имя</label>
                        <input
                          type="text"
                          className="form-control"
                          name="first_name"
                          value={createForm.first_name}
                          onChange={updateCreateField}
                          disabled={savingCreate}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Фамилия</label>
                        <input
                          type="text"
                          className="form-control"
                          name="last_name"
                          value={createForm.last_name}
                          onChange={updateCreateField}
                          disabled={savingCreate}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Эл. почта</label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={createForm.email}
                        onChange={updateCreateField}
                        disabled={savingCreate}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">
                          Телефон{createForm.role === 'parent' ? ' *' : ''}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="phone"
                          value={createForm.phone}
                          onChange={updateCreateField}
                          disabled={savingCreate}
                          required={createForm.role === 'parent'}
                        />
                        {createForm.role === 'parent' ? (
                          <div className="form-text">
                            Для роли «Родитель» номер телефона обязателен.
                          </div>
                        ) : null}
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Telegram ID</label>
                        <input
                          type="text"
                          className="form-control"
                          name="telegram_chat_id"
                          value={createForm.telegram_chat_id}
                          onChange={updateCreateField}
                          disabled={savingCreate}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Роль *</label>
                      <select
                        className="form-select"
                        name="role"
                        value={createForm.role}
                        onChange={updateCreateField}
                        disabled={savingCreate}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={`create-role-${role.code}`} value={role.code}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {createForm.role === 'student' ? (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Группа ученика</label>
                          <select
                            className="form-select"
                            name="group_id"
                            value={createForm.group_id}
                            onChange={updateCreateField}
                            disabled={savingCreate}
                          >
                            <option value="">Выберите группу</option>
                            {groups.map((group) => (
                              <option key={`create-group-${group.id}`} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Родитель</label>
                          <select
                            className="form-select"
                            name="parent_id"
                            value={createForm.parent_id}
                            onChange={updateCreateField}
                            disabled={savingCreate}
                          >
                            <option value="">— не выбран —</option>
                            {parentUsers.map((p) => (
                              <option key={`create-parent-${p.id}`} value={p.id}>
                                {`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}

                    {createForm.role === 'parent' ? (
                      <SearchableMultiSelect
                        label="Дети (ученики)"
                        items={studentUsers}
                        selectedIds={createForm.child_ids}
                        onToggle={(id) => setCreateForm((prev) => ({
                          ...prev,
                          child_ids: prev.child_ids.includes(id)
                            ? prev.child_ids.filter((x) => x !== id)
                            : [...prev.child_ids, id],
                        }))}
                        loading={savingCreate}
                        placeholder="Выберите учеников"
                        emptyText="Ученики не найдены"
                        renderLabel={(u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                      />
                    ) : null}
                  </div>
                  <div className="modal-footer border-0">
                    <button type="button" className="btn btn-light border rounded-pill px-4" onClick={closeCreateModal} disabled={savingCreate}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={savingCreate}>
                      {savingCreate ? 'Сохраняем…' : 'Создать'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {editingUser ? (
        <>
          <div className="modal-backdrop show" onClick={closeEditUser} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content rounded-4 border-0 shadow-lg">
                <div className="modal-header border-0">
                  <h5 className="modal-title fw-semibold">Редактировать пользователя</h5>
                  <button type="button" className="btn-close" onClick={closeEditUser} disabled={savingEdit} />
                </div>
                <form onSubmit={handleEditSubmit}>
                  <div className="modal-body">
                    {isEditingSelf ? (
                      <div className="alert alert-warning">
                        Для вашей учетной записи изменение ролей заблокировано, чтобы не потерять админ-доступ.
                      </div>
                    ) : null}

                    <div className="mb-3">
                      <label className="form-label">Имя пользователя *</label>
                      <input
                        type="text"
                        className="form-control"
                        name="username"
                        value={editForm.username}
                        onChange={updateEditField}
                        disabled={savingEdit}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Новый пароль (необязательно)</label>
                      <input
                        type="password"
                        className="form-control"
                        name="password"
                        value={editForm.password}
                        onChange={updateEditField}
                        disabled={savingEdit}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Имя</label>
                        <input
                          type="text"
                          className="form-control"
                          name="first_name"
                          value={editForm.first_name}
                          onChange={updateEditField}
                          disabled={savingEdit}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Фамилия</label>
                        <input
                          type="text"
                          className="form-control"
                          name="last_name"
                          value={editForm.last_name}
                          onChange={updateEditField}
                          disabled={savingEdit}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Эл. почта</label>
                      <input
                        type="email"
                        className="form-control"
                        name="email"
                        value={editForm.email}
                        onChange={updateEditField}
                        disabled={savingEdit}
                      />
                    </div>

                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">
                          Телефон{editForm.role === 'parent' ? ' *' : ''}
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          name="phone"
                          value={editForm.phone}
                          onChange={updateEditField}
                          disabled={savingEdit}
                          required={editForm.role === 'parent'}
                        />
                        {editForm.role === 'parent' ? (
                          <div className="form-text">
                            Для роли «Родитель» номер телефона обязателен.
                          </div>
                        ) : null}
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Telegram ID</label>
                        <input
                          type="text"
                          className="form-control"
                          name="telegram_chat_id"
                          value={editForm.telegram_chat_id}
                          onChange={updateEditField}
                          disabled={savingEdit}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label">Роль</label>
                      <select
                        className="form-select"
                        name="role"
                        value={editForm.role}
                        onChange={updateEditField}
                        disabled={savingEdit || isEditingSelf}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={`edit-role-${role.code}`} value={role.code}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {editForm.role === 'student' ? (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Группа ученика</label>
                          <select
                            className="form-select"
                            name="group_id"
                            value={editForm.group_id}
                            onChange={updateEditField}
                            disabled={savingEdit}
                          >
                            <option value="">Выберите группу</option>
                            {groups.map((group) => (
                              <option key={`edit-group-${group.id}`} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="mb-3">
                          <label className="form-label">Родитель</label>
                          <select
                            className="form-select"
                            name="parent_id"
                            value={editForm.parent_id}
                            onChange={updateEditField}
                            disabled={savingEdit}
                          >
                            <option value="">— не выбран —</option>
                            {parentUsers.map((p) => (
                              <option key={`edit-parent-${p.id}`} value={p.id}>
                                {`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}

                    {editForm.role === 'parent' ? (
                      <SearchableMultiSelect
                        label="Дети (ученики)"
                        items={studentUsers}
                        selectedIds={editForm.child_ids}
                        onToggle={(id) => setEditForm((prev) => ({
                          ...prev,
                          child_ids: prev.child_ids.includes(id)
                            ? prev.child_ids.filter((x) => x !== id)
                            : [...prev.child_ids, id],
                        }))}
                        loading={savingEdit}
                        placeholder="Выберите учеников"
                        emptyText="Ученики не найдены"
                        renderLabel={(u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username}
                      />
                    ) : null}
                  </div>
                  <div className="modal-footer border-0">
                    <button type="button" className="btn btn-light border rounded-pill px-4" onClick={closeEditUser} disabled={savingEdit}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-dark rounded-pill px-4" disabled={savingEdit}>
                      {savingEdit ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
};

const InfoField = ({ label, value }) => {
  if (!value) return null;
  return (
    <div className="col-md-6">
      <div
        className="rounded-3 p-2 px-3"
        style={{ background: '#f8f9fb' }}
      >
        <div
          className="text-muted small text-uppercase"
          style={{ letterSpacing: 0.4, fontSize: '0.7rem' }}
        >
          {label}
        </div>
        <div className="fw-semibold" style={{ fontSize: '0.92rem' }}>
          {value}
        </div>
      </div>
    </div>
  );
};
