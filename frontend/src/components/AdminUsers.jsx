import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';
import { useAuth } from '../context/AuthContext';

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

    if (createForm.role === 'student' && !createForm.group_id) {
      setError('Для ученика нужно выбрать группу.');
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
        group_ids: createForm.role === 'student' ? [Number(createForm.group_id)] : [],
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

    if (editForm.role === 'student' && !editForm.group_id) {
      setError('Для ученика нужно выбрать группу.');
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
        group_ids: editForm.role === 'student' ? [Number(editForm.group_id)] : [],
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
    <AdminLayout title="Управление пользователями">
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {success ? <div className="alert alert-success">{success}</div> : null}

      <div className="card mb-3">
        <div className="card-body d-flex flex-wrap gap-2 justify-content-between align-items-center">
          <div>
            <h5 className="mb-1">Пользователи</h5>
            <small className="text-muted">Управление учетными записями по категориям</small>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={loadUsers} disabled={loadingUsers}>
              Обновить
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreateModal}>
              Создать пользователя
            </button>
          </div>
        </div>
      </div>

      <ul className="nav nav-pills mb-3">
        {USER_CATEGORIES.map((category) => {
          const count = (categorizedUsers[category.key] || []).length;
          return (
            <li className="nav-item me-2 mb-2" key={category.key}>
              <button
                type="button"
                className={`btn btn-sm ${activeCategory === category.key ? 'btn-dark' : 'btn-outline-dark'}`}
                onClick={() => setActiveCategory(category.key)}
              >
                {category.title} ({count})
              </button>
            </li>
          );
        })}
      </ul>

      <div className="card mb-3">
        <div className="card-body d-flex gap-2 align-items-center">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Поиск: логин, имя, email"
            value={activeSearch}
            onChange={(event) => handleCategorySearchChange(event.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => handleCategorySearchChange('')}
            disabled={!activeSearch}
          >
            Очистить
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {loadingUsers ? (
            <div className="p-3">Загрузка...</div>
          ) : visibleUsers.length === 0 ? (
            <div className="p-3 text-muted">Пользователи не найдены.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Логин</th>
                    <th>Имя</th>
                    <th>Эл. почта</th>
                    <th>Роли</th>
                    <th className="text-end">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((row) => {
                    const displayName = `${row.first_name || ''} ${row.last_name || ''}`.trim();
                    const roles = Array.isArray(row.roles)
                      ? row.roles.map((roleCode) => roleMap[roleCode] || roleCode).join(', ')
                      : '-';
                    const isCurrentUser = currentUser?.id === row.id;
                    const isDeleting = deletingUserId === row.id;

                    return (
                      <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openViewUser(row)}>
                        <td>{row.id}</td>
                        <td>{row.username || '-'}</td>
                        <td>{displayName || '-'}</td>
                        <td>{row.email || '-'}</td>
                        <td>{row.is_superuser ? 'Суперпользователь' : roles || '-'}</td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditUser(row);
                              }}
                              disabled={isDeleting}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteUser(row);
                              }}
                              disabled={isCurrentUser || isDeleting}
                            >
                              {isDeleting ? 'Удаляем...' : 'Удалить'}
                            </button>
                          </div>
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

      {viewingUser ? (
        <>
          <div className="modal-backdrop show" onClick={closeViewUser} />
          <div className="modal show d-block" tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Профиль пользователя #{viewingUser.id}</h5>
                  <button type="button" className="btn-close" onClick={closeViewUser} />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div><strong>Логин:</strong> {viewingUser.username || '-'}</div>
                      <div><strong>Имя:</strong> {viewingUser.first_name || '-'}</div>
                      <div><strong>Фамилия:</strong> {viewingUser.last_name || '-'}</div>
                      <div><strong>Эл. почта:</strong> {viewingUser.email || '-'}</div>
                    </div>
                    <div className="col-md-6">
                      <div><strong>Телефон:</strong> {viewingUser.phone || '-'}</div>
                      <div><strong>Telegram ID:</strong> {viewingUser.telegram_chat_id || '-'}</div>
                      <div>
                        <strong>Роль:</strong>{' '}
                        {viewingUser.is_superuser
                          ? 'Суперпользователь'
                          : (Array.isArray(viewingUser.roles) && viewingUser.roles.length > 0
                            ? roleMap[viewingUser.roles[0]] || viewingUser.roles[0]
                            : '-')}
                      </div>
                      <div><strong>is_superuser:</strong> {viewingUser.is_superuser ? 'Да' : 'Нет'}</div>
                    </div>
                  </div>

                  {(Array.isArray(viewingUser.roles) && viewingUser.roles[0] === 'student') || viewingUserGroups.length > 0 ? (
                    <>
                      <hr />
                      <div>
                        <strong>Группа ученика:</strong>{' '}
                        {viewingUserGroups.length > 0
                          ? viewingUserGroups.map((group) => group.name).join(', ')
                          : 'Не назначена'}
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeViewUser}>
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
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Создать пользователя</h5>
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
                        <label className="form-label">Телефон</label>
                        <input
                          type="text"
                          className="form-control"
                          name="phone"
                          value={createForm.phone}
                          onChange={updateCreateField}
                          disabled={savingCreate}
                        />
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
                      <div className="mb-3">
                        <label className="form-label">Группа ученика *</label>
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
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeCreateModal} disabled={savingCreate}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={savingCreate}>
                      {savingCreate ? 'Сохраняем...' : 'Создать'}
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
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Редактировать пользователя #{editingUser.id}</h5>
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
                        <label className="form-label">Телефон</label>
                        <input
                          type="text"
                          className="form-control"
                          name="phone"
                          value={editForm.phone}
                          onChange={updateEditField}
                          disabled={savingEdit}
                        />
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
                      <div className="mb-3">
                        <label className="form-label">Группа ученика *</label>
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
                    ) : null}
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-outline-secondary" onClick={closeEditUser} disabled={savingEdit}>
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                      {savingEdit ? 'Сохраняем...' : 'Сохранить'}
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
