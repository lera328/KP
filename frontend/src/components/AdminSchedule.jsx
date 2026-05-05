import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AdminLayout } from './AdminLayout';

const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const formatDateTime = (value) => {
	if (!value) return '-';
	return new Date(value).toLocaleString('ru-RU');
};

const toInputDateTime = (date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const AdminSchedule = () => {
	const [groups, setGroups] = useState([]);
	const [teachers, setTeachers] = useState([]);
	const [topics, setTopics] = useState([]);
	const [lessons, setLessons] = useState([]);

	const [loading, setLoading] = useState(true);
	const [savingSchedule, setSavingSchedule] = useState(false);
	const [savingLesson, setSavingLesson] = useState(false);
	const [savingEdit, setSavingEdit] = useState(false);
	const [deletingLessonId, setDeletingLessonId] = useState(null);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [groupFilter, setGroupFilter] = useState('');
	const [teacherFilter, setTeacherFilter] = useState('');

	const [scheduleForm, setScheduleForm] = useState({
		group: '',
		teacher: '',
		starts_at: toInputDateTime(new Date()),
	});

	const [lessonForm, setLessonForm] = useState({
		group: '',
		teacher: '',
		starts_at: toInputDateTime(new Date()),
	});
	const [editingLessonId, setEditingLessonId] = useState(null);
	const [editForm, setEditForm] = useState({
		teacher: '',
	});

	const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
	const topicMap = useMemo(() => new Map(topics.map((topic) => [topic.id, topic])), [topics]);
	const teacherMap = useMemo(() => new Map(teachers.map((teacher) => [teacher.id, teacher])), [teachers]);

	const teacherLabel = (teacher) => {
		if (!teacher) return '-';
		const fullName = `${teacher.first_name || ''} ${teacher.last_name || ''}`.trim();
		return fullName || teacher.username || `ID ${teacher.id}`;
	};

	const filteredLessons = useMemo(() => {
		return lessons.filter((lesson) => {
			if (groupFilter && Number(lesson.group) !== Number(groupFilter)) {
				return false;
			}
			if (teacherFilter && Number(lesson.teacher) !== Number(teacherFilter)) {
				return false;
			}
			return true;
		});
	}, [lessons, groupFilter, teacherFilter]);

	const groupLabel = (group) => {
		if (!group) return '-';
		if (group.weekly_lesson_weekday === null || !group.weekly_lesson_time) {
			return `${group.name} (слот не задан)`;
		}

		const weekday = WEEKDAY_LABELS[group.weekly_lesson_weekday] || `День #${group.weekly_lesson_weekday}`;
		const timeValue = String(group.weekly_lesson_time).slice(0, 5);
		return `${group.name} (${weekday} ${timeValue})`;
	};

	const loadData = async () => {
		setLoading(true);
		setError('');
		try {
			const [groupsData, usersData, topicsData, lessonsData] = await Promise.all([
				api.getGroups(),
				api.getUsers(),
				api.getLessonTopics(),
				api.getLessons(),
			]);

			const safeGroups = Array.isArray(groupsData) ? groupsData : [];
			const safeUsers = Array.isArray(usersData) ? usersData : [];
			const safeTopics = Array.isArray(topicsData) ? topicsData : [];
			const safeLessons = Array.isArray(lessonsData) ? lessonsData : [];

			const teacherUsers = safeUsers.filter(
				(userItem) => userItem?.is_superuser || (Array.isArray(userItem?.roles) && userItem.roles.includes('teacher')),
			);

			setGroups(safeGroups);
			setTeachers(teacherUsers);
			setTopics(safeTopics);
			setLessons(
				safeLessons
					.slice()
					.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)),
			);

			setLessonForm((prev) => ({
				...prev,
				group: prev.group || safeGroups[0]?.id || '',
				teacher: prev.teacher || teacherUsers[0]?.id || '',
			}));

			setScheduleForm((prev) => ({
				...prev,
				group: prev.group || safeGroups[0]?.id || '',
				teacher: prev.teacher || teacherUsers[0]?.id || '',
			}));
		} catch (loadError) {
			setError(loadError.message || 'Не удалось загрузить данные расписания.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		loadData();
	}, []);

	const handleCreateLesson = async (event) => {
		event.preventDefault();
		setError('');
		setSuccess('');

		if (!lessonForm.group || !lessonForm.teacher || !lessonForm.starts_at) {
			setError('Заполни группу, преподавателя и дату/время.');
			return;
		}

		setSavingLesson(true);
		try {
			await api.addExtraLesson({
				group_id: Number(lessonForm.group),
				teacher_id: Number(lessonForm.teacher),
				starts_at: new Date(lessonForm.starts_at).toISOString(),
			});
			setSuccess('Разовое занятие добавлено в свободный слот.');
			await loadData();
		} catch (saveError) {
			setError(saveError.message || 'Не удалось создать урок.');
		} finally {
			setSavingLesson(false);
		}
	};

	const handleSetupGroupSchedule = async (event) => {
		event.preventDefault();
		setError('');
		setSuccess('');

		if (!scheduleForm.group || !scheduleForm.teacher || !scheduleForm.starts_at) {
			setError('Заполни группу, преподавателя и стартовое время.');
			return;
		}

		setSavingSchedule(true);
		try {
			const result = await api.setupGroupSchedule({
				group_id: Number(scheduleForm.group),
				teacher_id: Number(scheduleForm.teacher),
				starts_at: new Date(scheduleForm.starts_at).toISOString(),
			});

			const createdCount = Number(result?.created_count || 0);
			setSuccess(`Регулярное расписание настроено. Создано занятий: ${createdCount}.`);
			await loadData();
		} catch (saveError) {
			setError(saveError.message || 'Не удалось настроить регулярное расписание.');
		} finally {
			setSavingSchedule(false);
		}
	};

	const openEditLesson = (lesson) => {
		setEditingLessonId(lesson.id);
		setEditForm({
			teacher: String(lesson.teacher),
		});
		setError('');
		setSuccess('');
	};

	const cancelEditLesson = () => {
		setEditingLessonId(null);
		setEditForm({ teacher: '' });
	};

	const handleUpdateLesson = async (lesson) => {
		setError('');
		setSuccess('');

		if (!editForm.teacher) {
			setError('Для редактирования урока укажи преподавателя.');
			return;
		}

		setSavingEdit(true);
		try {
			await api.updateLesson(lesson.id, {
				teacher: Number(editForm.teacher),
			});
			setSuccess('Преподаватель урока обновлён.');
			cancelEditLesson();
			await loadData();
		} catch (saveError) {
			setError(saveError.message || 'Не удалось обновить урок.');
		} finally {
			setSavingEdit(false);
		}
	};

	const handleDeleteLesson = async (lessonId) => {
		const confirmed = window.confirm('Удалить этот урок?');
		if (!confirmed) {
			return;
		}

		setError('');
		setSuccess('');
		setDeletingLessonId(lessonId);
		try {
			await api.deleteLesson(lessonId);
			setSuccess('Урок удалён.');
			if (editingLessonId === lessonId) {
				cancelEditLesson();
			}
			await loadData();
		} catch (deleteError) {
			setError(deleteError.message || 'Не удалось удалить урок.');
		} finally {
			setDeletingLessonId(null);
		}
	};

	return (
		<AdminLayout title="Админ — расписание">
				{error && <div className="alert alert-danger">{error}</div>}
				{success && <div className="alert alert-success">{success}</div>}

				<div className="row g-4">
					<div className="col-lg-4">
						<div className="card mb-4">
							<div className="card-header">
								<strong>Настроить регулярное расписание группы</strong>
							</div>
							<div className="card-body">
								<form onSubmit={handleSetupGroupSchedule}>
									<div className="mb-3">
										<label className="form-label">Группа</label>
										<select
											className="form-select"
											value={scheduleForm.group}
											onChange={(event) => setScheduleForm((prev) => ({ ...prev, group: event.target.value }))}
											disabled={savingSchedule || loading}
										>
											<option value="">Выбери группу</option>
											{groups.map((group) => (
												<option key={group.id} value={group.id}>
													{groupLabel(group)}
												</option>
											))}
										</select>
									</div>

									<div className="mb-3">
										<label className="form-label">Преподаватель</label>
										<select
											className="form-select"
											value={scheduleForm.teacher}
											onChange={(event) => setScheduleForm((prev) => ({ ...prev, teacher: event.target.value }))}
											disabled={savingSchedule || loading}
										>
											<option value="">Выбери преподавателя</option>
											{teachers.map((teacher) => (
												<option key={teacher.id} value={teacher.id}>
													{teacherLabel(teacher)}
												</option>
											))}
										</select>
									</div>

									<div className="mb-3">
										<label className="form-label">Стартовое занятие (день и время)</label>
										<input
											type="datetime-local"
											className="form-control"
											value={scheduleForm.starts_at}
											onChange={(event) => setScheduleForm((prev) => ({ ...prev, starts_at: event.target.value }))}
											disabled={savingSchedule || loading}
										/>
									</div>

									<button type="submit" className="btn btn-primary" disabled={savingSchedule || loading}>
										{savingSchedule ? 'Настраиваем...' : 'Прописать на год'}
									</button>
								</form>
							</div>
						</div>

						<div className="card">
							<div className="card-header">
								<strong>Добавить разовое занятие (свободный слот)</strong>
							</div>
							<div className="card-body">
								<form onSubmit={handleCreateLesson}>
									<div className="mb-3">
										<label className="form-label">Группа</label>
										<select
											className="form-select"
											value={lessonForm.group}
											onChange={(event) => setLessonForm((prev) => ({ ...prev, group: event.target.value }))}
											disabled={savingLesson || loading}
										>
											<option value="">Выбери группу</option>
											{groups.map((group) => (
												<option key={group.id} value={group.id}>
													{groupLabel(group)}
												</option>
											))}
										</select>
									</div>

									<div className="mb-3">
										<label className="form-label">Преподаватель</label>
										<select
											className="form-select"
											value={lessonForm.teacher}
											onChange={(event) => setLessonForm((prev) => ({ ...prev, teacher: event.target.value }))}
											disabled={savingLesson || loading}
										>
											<option value="">Выбери преподавателя</option>
											{teachers.map((teacher) => (
												<option key={teacher.id} value={teacher.id}>
													{teacherLabel(teacher)}
												</option>
											))}
										</select>
									</div>

									<div className="mb-3">
										<label className="form-label">Дата и время</label>
										<input
											type="datetime-local"
											className="form-control"
											value={lessonForm.starts_at}
											onChange={(event) => setLessonForm((prev) => ({ ...prev, starts_at: event.target.value }))}
											disabled={savingLesson || loading}
										/>
									</div>

									<div className="alert alert-info mt-3 mb-0">
										Система не даст занять уже занятый слот группы или преподавателя.
									</div>

									<button type="submit" className="btn btn-primary" disabled={savingLesson || loading}>
										{savingLesson ? 'Сохраняем...' : 'Добавить разовое занятие'}
									</button>
								</form>
							</div>
						</div>
					</div>

					<div className="col-lg-8">
						<div className="card">
							<div className="card-header d-flex justify-content-between align-items-center">
								<strong>Список уроков</strong>
								<div className="d-flex gap-2">
									<select
										className="form-select form-select-sm"
										value={groupFilter}
										onChange={(event) => setGroupFilter(event.target.value)}
										disabled={loading}
									>
										<option value="">Все группы</option>
										{groups.map((group) => (
											<option key={group.id} value={group.id}>
												{group.name}
											</option>
										))}
									</select>
									<select
										className="form-select form-select-sm"
										value={teacherFilter}
										onChange={(event) => setTeacherFilter(event.target.value)}
										disabled={loading}
									>
										<option value="">Все преподаватели</option>
										{teachers.map((teacher) => (
											<option key={teacher.id} value={teacher.id}>
												{teacherLabel(teacher)}
											</option>
										))}
									</select>
									<button className="btn btn-outline-secondary btn-sm" onClick={loadData} disabled={loading}>
										Обновить
									</button>
								</div>
							</div>
							<div className="card-body p-0">
								{loading ? (
									<div className="p-3">Загрузка...</div>
								) : filteredLessons.length === 0 ? (
									<div className="p-3 text-muted">Уроки пока не созданы.</div>
								) : (
									<div className="table-responsive">
										<table className="table table-striped table-hover mb-0">
											<thead>
												<tr>
													<th>#</th>
													<th>Дата и время</th>
													<th>Группа</th>
													<th>Преподаватель</th>
													<th>Тип</th>
													<th>Тема</th>
													<th className="text-end">Действия</th>
												</tr>
											</thead>
											<tbody>
												{filteredLessons.map((lesson) => {
													const group = groupMap.get(lesson.group);
													const topic = topicMap.get(lesson.topic);
													const teacher = teacherMap.get(lesson.teacher);
													const isEditing = editingLessonId === lesson.id;
													return (
														<tr key={lesson.id}>
															<td>{lesson.id}</td>
															<td>{formatDateTime(lesson.starts_at)}</td>
															<td>{group?.name || `Группа #${lesson.group}`}</td>
															<td>
																{isEditing ? (
																	<select
																		className="form-select form-select-sm"
																		value={editForm.teacher}
																		onChange={(event) => setEditForm((prev) => ({ ...prev, teacher: event.target.value }))}
																		disabled={savingEdit}
																	>
																		{teachers.map((teacherOption) => (
																			<option key={teacherOption.id} value={teacherOption.id}>
																				{teacherLabel(teacherOption)}
																			</option>
																		))}
																	</select>
																) : (
																	teacherLabel(teacher)
																)}
															</td>
															<td>{lesson.is_extra ? 'Разовое' : 'Регулярное'}</td>
															<td>{topic?.title || `Тема #${lesson.topic}`}</td>
															<td className="text-end">
																{isEditing ? (
																	<div className="d-flex gap-2 justify-content-end">
																		<button
																			className="btn btn-success btn-sm"
																			onClick={() => handleUpdateLesson(lesson)}
																			disabled={savingEdit}
																		>
																			{savingEdit ? 'Сохраняем...' : 'Сменить преподавателя'}
																		</button>
																		<button className="btn btn-outline-secondary btn-sm" onClick={cancelEditLesson} disabled={savingEdit}>
																			Отмена
																		</button>
																	</div>
																) : (
																	<div className="d-flex gap-2 justify-content-end">
																		<button className="btn btn-outline-primary btn-sm" onClick={() => openEditLesson(lesson)}>
																			Изменить
																		</button>
																		<button
																			className="btn btn-outline-danger btn-sm"
																			onClick={() => handleDeleteLesson(lesson.id)}
																			disabled={deletingLessonId === lesson.id}
																		>
																			{deletingLessonId === lesson.id ? 'Удаляем...' : 'Удалить'}
																		</button>
																	</div>
																)}
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
					</div>
				</div>
		</AdminLayout>
	);
};
