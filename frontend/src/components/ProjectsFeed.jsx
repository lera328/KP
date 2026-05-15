import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, getNavItemsForUser } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const FILTER_ALL = 'all';
const FILTER_MINE = 'mine';

export const ProjectsFeed = () => {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const isStudent = hasRole('student');
  const isParent = hasRole('parent');
  const isAdmin = hasRole('admin');
  const useKidMode = true;

  const [projects, setProjects] = useState([]);
  const [topProject, setTopProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState(FILTER_ALL);
  const [childrenIds, setChildrenIds] = useState(null); // Set<number> для родителя

  const loadFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const promises = [api.getProjectsFeed()];
      if (isParent && childrenIds === null) {
        promises.push(api.getParentChildren());
      }
      const [feedData, childrenData] = await Promise.all(promises);
      setTopProject(feedData?.top_project || null);
      setProjects(Array.isArray(feedData?.projects) ? feedData.projects : []);
      if (childrenData) {
        setChildrenIds(new Set((Array.isArray(childrenData) ? childrenData : []).map((c) => c.id)));
      }
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить ленту проектов.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleDelete = async (project) => {
    if (!window.confirm(`Удалить проект «${project.title}»?`)) return;
    try {
      await api.deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      if (topProject && topProject.id === project.id) setTopProject(null);
    } catch (e) {
      setError(e.message || 'Не удалось удалить проект.');
    }
  };

  const toggleLike = async (project) => {
    try {
      const response = project.liked_by_me
        ? await api.unlikeProject(project.id)
        : await api.likeProject(project.id);

      const update = (item) =>
        item.id === project.id
          ? {
              ...item,
              liked_by_me: !project.liked_by_me,
              likes_count: response?.likes_count ?? item.likes_count,
              likes_week: response?.likes_week ?? item.likes_week,
            }
          : item;

      setProjects((prev) => prev.map(update));
      if (topProject && topProject.id === project.id) {
        setTopProject((prev) => update(prev));
      }
    } catch (likeError) {
      setError(likeError.message || 'Не удалось обновить лайк.');
    }
  };

  const filteredProjects = useMemo(() => {
    const base = projects.filter((p) => !topProject || p.id !== topProject.id);
    if (filter !== FILTER_MINE) return base;
    return base.filter((p) => {
      if (isStudent) return p.student_id === user?.id;
      if (isParent && childrenIds) return childrenIds.has(p.student_id);
      return false;
    });
  }, [projects, topProject, filter, isStudent, isParent, user?.id, childrenIds]);

  const showTopProject = filter === FILTER_ALL && topProject;
  const canFilter = isStudent || isParent;

  return (
    <AppLayout title="Лента проектов" navItems={getNavItemsForUser(user, hasRole)} kidMode={useKidMode} bottomNav={isStudent || isParent ? undefined : false}>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '1.75rem' }}>Лента проектов</h1>
        <div className="ms-auto d-flex gap-2">
          {isStudent && (
            <button
              type="button"
              className="btn btn-dark rounded-pill px-4"
              onClick={() => navigate('/student/projects')}
            >
              + Добавить проект
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}

      {/* Фильтры */}
      {canFilter && (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {[
            { value: FILTER_ALL, label: 'Все проекты' },
            { value: FILTER_MINE, label: isParent ? 'Проекты моих детей' : 'Мои проекты' },
          ].map((pill) => (
            <button
              key={pill.value}
              type="button"
              className="btn btn-sm rounded-pill px-3"
              style={{
                background: filter === pill.value ? '#111827' : '#f8f9fb',
                color: filter === pill.value ? '#fff' : '#374151',
                border: `1px solid ${filter === pill.value ? '#111827' : '#e5e7eb'}`,
                fontWeight: 600,
              }}
              onClick={() => setFilter(pill.value)}
            >
              {pill.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="d-flex flex-column gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="kid-skeleton" style={{ height: 160, borderRadius: 16 }} />
          ))}
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {showTopProject && (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="px-4 py-2 d-flex align-items-center gap-2" style={{ background: '#fffbeb' }}>
                <span style={{ fontSize: '1.1rem' }}>⭐</span>
                <span className="fw-semibold small" style={{ color: '#b45309' }}>Лучший проект недели</span>
              </div>
              <div className="card-body p-4">
                <ProjectCard project={topProject} isAdmin={isAdmin} onDelete={handleDelete} onLike={toggleLike} />
              </div>
            </div>
          )}

          {filteredProjects.length === 0 && !showTopProject ? (
            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body text-center py-5 text-muted">
                {filter === FILTER_MINE ? 'Проектов не найдено.' : 'Проектов пока нет.'}
              </div>
            </div>
          ) : (
            filteredProjects.map((project) => (
              <div key={project.id} className="card border-0 shadow-sm rounded-4">
                <div className="card-body p-4">
                  <ProjectCard project={project} isAdmin={isAdmin} onDelete={handleDelete} onLike={toggleLike} />
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AppLayout>
  );
};

const ProjectCard = ({ project, isAdmin, onDelete, onLike }) => (
  <div>
    <div className="d-flex justify-content-between align-items-start gap-3">
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        <div className="fw-semibold" style={{ fontSize: '1.1rem' }}>{project.title}</div>
        <div className="text-muted small d-flex flex-wrap gap-2 mt-1">
          <span>{project.student_name || 'Автор'}</span>
          <span>·</span>
          <span>{formatDateTime(project.created_at)}</span>
          {(project.likes_week > 0) && (
            <>
              <span>·</span>
              <span style={{ color: '#b45309' }}>за неделю: {project.likes_week}</span>
            </>
          )}
        </div>
      </div>
      <div className="d-flex gap-2 align-items-center flex-shrink-0">
        <button
          type="button"
          className="btn btn-sm rounded-pill px-3"
          style={{
            background: project.liked_by_me ? '#fef2f2' : '#f8f9fb',
            color: project.liked_by_me ? '#dc2626' : '#6b7280',
            border: `1px solid ${project.liked_by_me ? '#fecaca' : '#e5e7eb'}`,
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onClick={() => onLike(project)}
        >
          ❤ {project.likes_count || 0}
        </button>
        {isAdmin && (
          <button
            type="button"
            className="btn btn-sm rounded-pill px-3"
            style={{ background: '#f8f9fb', color: '#dc2626', border: '1px solid #e5e7eb' }}
            onClick={() => onDelete(project)}
            title="Удалить проект"
          >
            Удалить
          </button>
        )}
      </div>
    </div>

    {project.description && (
      <div className="mt-2" style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{project.description}</div>
    )}

    {project.project_url && (
      <a
        href={project.project_url}
        target="_blank"
        rel="noreferrer"
        className="btn btn-sm rounded-pill px-3 mt-2"
        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontWeight: 500 }}
      >
        Открыть проект ↗
      </a>
    )}

    {Array.isArray(project.images) && project.images.length > 0 && (
      <div className="mt-3 d-flex flex-wrap gap-2">
        {project.images.map((image) => (
          <img
            key={image.id}
            src={image.url}
            alt=""
            style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 12 }}
          />
        ))}
      </div>
    )}

    {Array.isArray(project.files) && project.files.length > 0 && (
      <div className="mt-3 d-flex flex-wrap gap-2">
        {project.files.map((f) => (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            download={f.name}
            className="rounded-pill px-3 py-1 text-decoration-none small"
            style={{ background: '#f8f9fb', color: '#374151', border: '1px solid #e5e7eb' }}
          >
            📎 {f.name}
          </a>
        ))}
      </div>
    )}
  </div>
);
