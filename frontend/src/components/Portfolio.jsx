import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, parentNavItems, studentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('ru-RU');
};

const formatDateTime = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleString('ru-RU');
};

const STATUS_LABELS = {
  present: 'Присутствовал',
  makeup: 'Отработал',
};

/**
 * Универсальная страница портфолио ученика. Используется и учеником,
 * и родителем (когда смотрит портфолио ребёнка по `:studentId` из URL).
 */
export const Portfolio = ({ mode = 'student' }) => {
  const { hasRole } = useAuth();
  const params = useParams();
  const studentId = mode === 'parent' ? params.studentId : undefined;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const navItems = mode === 'parent' ? parentNavItems : studentNavItems;
  const layoutTitle =
    mode === 'parent' ? 'КиберШкола — Портфолио ребёнка' : 'КиберШкола — Моё портфолио';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.getPortfolio({ studentId });
      setData(result);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить портфолио.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    setError('');
    setSuccess('');
    try {
      const result = await api.downloadPortfolioPdf({ studentId });
      if (!result) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess('PDF портфолио скачан.');
    } catch (downloadError) {
      setError(downloadError.message || 'Не удалось сформировать PDF.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyPublicUrl = async () => {
    if (!data?.public_url) return;
    try {
      await navigator.clipboard.writeText(data.public_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('Не удалось скопировать ссылку: ' + (e.message || ''));
    }
  };

  const lessons = useMemo(() => {
    if (!data?.lessons) return [];
    return data.lessons;
  }, [data]);

  const kid = mode === 'student';

  return (
    <AppLayout title={layoutTitle} navItems={navItems} kidMode={kid}>
      {error && <div className={kid ? 'alert alert-danger rounded-4' : 'alert alert-danger'}>{error}</div>}
      {success && <div className={kid ? 'alert alert-success rounded-4' : 'alert alert-success'}>{success}</div>}

      {loading ? (
        <div className="p-3">Загрузка портфолио…</div>
      ) : !data ? (
        <div className="alert alert-warning mb-0">Портфолио не загрузилось.</div>
      ) : (
        <>
          {/* Заголовок */}
          {kid ? (
            <div className="mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-3">
                <div>
                  <div className="text-muted small">Моё портфолио</div>
                  <h1 className="fw-semibold mb-1" style={{ fontSize: '2rem' }}>
                    {data.student.name}
                  </h1>
                  <div className="text-muted small">
                    Обновлено {formatDateTime(data.generated_at)}
                  </div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-dark rounded-pill px-3"
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                  >
                    {downloading ? 'Готовим PDF…' : 'Скачать PDF'}
                  </button>
                  {data.public_url ? (
                    <button
                      className="btn btn-light border rounded-pill px-3"
                      onClick={handleCopyPublicUrl}
                    >
                      {copied ? 'Скопировано' : 'Скопировать ссылку'}
                    </button>
                  ) : null}
                  <button
                    className="btn btn-light border rounded-pill px-3"
                    onClick={load}
                    disabled={loading}
                  >
                    Обновить
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="card mb-3">
              <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex flex-wrap gap-2">
                  <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={downloading}>
                    {downloading ? 'Готовим PDF…' : 'Скачать PDF'}
                  </button>
                  {data.public_url ? (
                    <button className="btn btn-outline-primary" onClick={handleCopyPublicUrl}>
                      {copied ? '✔ Скопировано' : 'Скопировать публичную ссылку'}
                    </button>
                  ) : null}
                  <button className="btn btn-outline-secondary" onClick={load} disabled={loading}>
                    Обновить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Статистика */}
          <div className="row g-3 mb-4">
            <StatCard kid={kid} label="Проектов" value={data.stats.projects_total} />
            <StatCard kid={kid} label="Посещено занятий" value={data.stats.lessons_attended} />
            <StatCard kid={kid} label="Получено лайков" value={data.stats.likes_total} />
            <StatCard kid={kid} label="Средняя оценка" value={data.stats.grades_average ?? '—'} />
          </div>

          {/* Группы — скрыты в детском режиме */}
          {!kid && Array.isArray(data.groups) && data.groups.length > 0 ? (
            <div className={kid ? 'card border-0 shadow-sm rounded-4 mb-4' : 'card mb-3'}>
              <div className={kid ? 'card-body pb-2' : 'card-header'}>
                <strong>Группы и направления</strong>
              </div>
              <ul className={kid ? 'list-group list-group-flush rounded-bottom-4' : 'list-group list-group-flush'}>
                {data.groups.map((g, idx) => (
                  <li key={`${g.name}-${idx}`} className="list-group-item d-flex justify-content-between border-0" style={kid ? { background: 'transparent' } : undefined}>
                    <span>{g.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Проекты */}
          <div className={kid ? 'card border-0 shadow-sm rounded-4 mb-4' : 'card mb-3'}>
            <div className={kid ? 'card-body pb-2' : 'card-header'}>
              <strong>Проекты {data.projects?.length ? `(${data.projects.length})` : ''}</strong>
            </div>
            <div className="card-body p-0">
              {!data.projects || data.projects.length === 0 ? (
                <div className="p-3 text-muted">
                  Проектов пока нет. Самое время создать первый!
                </div>
              ) : (
                <ul className="list-group list-group-flush">
                  {data.projects.map((project) => (
                    <li key={project.id} className="list-group-item">
                      <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{project.title}</div>
                          {project.description ? (
                            <div className="text-muted small" style={{ whiteSpace: 'pre-wrap' }}>
                              {project.description}
                            </div>
                          ) : null}
                          {project.project_url ? (
                            <div className="small">
                              <a
                                href={project.project_url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Открыть проект
                              </a>
                            </div>
                          ) : null}
                          {Array.isArray(project.images) && project.images.length > 0 ? (
                            <div className="mt-2 d-flex flex-wrap gap-2">
                              {project.images.map((image) => (
                                <img
                                  key={image.id}
                                  src={image.url}
                                  alt=""
                                  style={{
                                    width: 96,
                                    height: 72,
                                    objectFit: 'cover',
                                    borderRadius: 6,
                                  }}
                                />
                              ))}
                            </div>
                          ) : null}
                          {Array.isArray(project.files) && project.files.length > 0 ? (
                            <div className="mt-2">
                              <div className="text-muted small">Прикреплённые файлы:</div>
                              <ul className="list-unstyled mb-0 small">
                                {project.files.map((f) => (
                                  <li key={f.id}>
                                    <a href={f.url} target="_blank" rel="noreferrer" download={f.name}>
                                      {f.name}
                                    </a>
                                    {f.size ? (
                                      <span className="text-muted ms-2">
                                        {(f.size / 1024).toFixed(0)} КБ
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                        <div className="text-end text-muted small ms-3">
                          <div>{formatDate(project.created_at)}</div>
                          <div>♥ {project.likes_count}</div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Пройденные занятия и оценки — скрыты в детском режиме */}
          {!kid && (
          <div className={kid ? 'card border-0 shadow-sm rounded-4 mb-4' : 'card mb-3'}>
            <div className={kid ? 'card-body pb-0' : 'card-header'}>
              <strong>{kid ? 'Пройденные занятия' : `Пройденные занятия и оценки (${lessons.length})`}</strong>
              {data.grades_summary?.count ? (
                <span className="ms-2 text-muted small">
                  {kid ? '' : 'Получено оценок:'} {data.grades_summary.count} · Средняя:{' '}
                  {data.grades_summary.average} · Диапазон:{' '}
                  {data.grades_summary.min}–{data.grades_summary.max}
                </span>
              ) : (
                <span className="ms-2 text-muted small">Оценок пока нет.</span>
              )}
            </div>
            <div className={kid ? 'card-body pt-3' : 'card-body p-0'}>
              {lessons.length === 0 ? (
                <div className={kid ? 'text-muted text-center py-3' : 'p-3 text-muted'}>
                  Посещений ещё нет.
                </div>
              ) : kid ? (
                <div className="d-flex flex-column gap-2">
                  {lessons.map((lesson) => (
                    <KidLessonCard key={lesson.lesson_id} lesson={lesson} />
                  ))}
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Тема</th>
                        <th>Группа</th>
                        <th>Статус</th>
                        <th>Оценка</th>
                        <th>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessons.map((lesson) => (
                        <tr key={lesson.lesson_id}>
                          <td className="text-nowrap">{formatDateTime(lesson.starts_at)}</td>
                          <td>
                            {lesson.topic}
                            {lesson.is_makeup ? (
                              <span className="badge text-bg-info ms-2" style={{ fontSize: '0.7em' }}>
                                Отработка
                              </span>
                            ) : null}
                          </td>
                          <td>{lesson.group_name || '—'}</td>
                          <td>{STATUS_LABELS[lesson.status] || lesson.status}</td>
                          <td>
                            {lesson.grade ? (
                              <span className="badge text-bg-success">{lesson.grade}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="small">{lesson.teacher_comment || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          )}
        </>
      )}
    </AppLayout>
  );
};

const StatCard = ({ label, value, kid = false }) => (
  <div className="col-6 col-md-3">
    <div className={kid ? 'card border-0 shadow-sm rounded-4 h-100' : 'card h-100'}>
      <div className={kid ? 'card-body p-3' : 'card-body text-center'}>
        {kid ? (
          <>
            <div
              className="text-muted small text-uppercase mb-1"
              style={{ letterSpacing: 0.5, fontSize: '0.7rem' }}
            >
              {label}
            </div>
            <div className="fw-semibold" style={{ fontSize: '1.75rem', lineHeight: 1.1 }}>
              {value}
            </div>
          </>
        ) : (
          <>
            <div className="display-6 fw-bold text-primary">{value}</div>
            <div className="text-muted small text-uppercase">{label}</div>
          </>
        )}
      </div>
    </div>
  </div>
);

const KidLessonCard = ({ lesson }) => {
  const status = lesson.status;
  const statusMeta =
    status === 'present'
      ? { label: 'Был', color: '#16a34a', bg: '#ecfdf5' }
      : status === 'makeup'
      ? { label: 'Отработал', color: '#2563eb', bg: '#eff6ff' }
      : { label: status || '—', color: '#475569', bg: '#f1f5f9' };

  const grade = lesson.grade;

  return (
    <div className="rounded-3 p-3" style={{ background: '#f8f9fb' }}>
      <div className="d-flex flex-wrap align-items-start gap-3">
        <div className="flex-grow-1" style={{ minWidth: 200 }}>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="fw-semibold">{lesson.topic || 'Занятие'}</span>
            <span
              className="badge rounded-pill"
              style={{ background: statusMeta.bg, color: statusMeta.color, fontWeight: 500 }}
            >
              {statusMeta.label}
            </span>
            {lesson.is_makeup ? (
              <span
                className="badge rounded-pill"
                style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 500 }}
              >
                Отработка
              </span>
            ) : null}
          </div>
          <div className="text-muted small">
            {formatDateTime(lesson.starts_at)}
            {lesson.group_name ? ` · ${lesson.group_name}` : ''}
          </div>
          {lesson.teacher_comment ? (
            <div className="small mt-1 text-muted">{lesson.teacher_comment}</div>
          ) : null}
        </div>
        {grade ? (
          <div
            className="rounded-3 px-3 py-2 text-center fw-semibold flex-shrink-0"
            style={{
              background: '#ffffff',
              minWidth: 56,
              fontSize: '1.4rem',
              lineHeight: 1.1,
              border: '1px solid #e5e7eb',
            }}
          >
            {grade}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Portfolio;
