import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, getNavItemsForUser } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const ProjectsFeed = () => {
  const { user, hasRole } = useAuth();

  const [projects, setProjects] = useState([]);
  const [topProject, setTopProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getProjectsFeed();
      setTopProject(data?.top_project || null);
      setProjects(Array.isArray(data?.projects) ? data.projects : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить ленту проектов.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const toggleLike = async (project) => {
    try {
      const response = project.liked_by_me
        ? await api.unlikeProject(project.id)
        : await api.likeProject(project.id);

      const nextProjects = projects.map((item) =>
        item.id === project.id
          ? {
              ...item,
              liked_by_me: !project.liked_by_me,
              likes_count: response?.likes_count ?? item.likes_count,
              likes_week: response?.likes_week ?? item.likes_week,
            }
          : item,
      );

      setProjects(nextProjects);
      if (topProject && topProject.id === project.id) {
        setTopProject({
          ...topProject,
          liked_by_me: !project.liked_by_me,
          likes_count: response?.likes_count ?? topProject.likes_count,
          likes_week: response?.likes_week ?? topProject.likes_week,
        });
      }
    } catch (likeError) {
      setError(likeError.message || 'Не удалось обновить лайк.');
    }
  };

  const renderImages = (project) => {
    if (!Array.isArray(project.images) || project.images.length === 0) {
      return null;
    }

    return (
      <div className="mt-2 d-flex flex-wrap gap-2">
        {project.images.map((image) => (
          <img
            key={image.id}
            src={image.url}
            alt=""
            style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8 }}
          />
        ))}
      </div>
    );
  };

  const renderProjectCard = (project) => (
    <div className="card mb-3" key={project.id}>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <div className="fw-semibold fs-5">{project.title}</div>
            <div className="text-muted small">
              {project.student_name || 'Автор'} · {formatDateTime(project.created_at)}
            </div>
            <div className="text-muted small">Лайков за неделю: {project.likes_week || 0}</div>
          </div>
          <button
            className={`btn btn-sm ${project.liked_by_me ? 'btn-danger' : 'btn-outline-danger'}`}
            onClick={() => toggleLike(project)}
          >
            ❤️ {project.likes_count || 0}
          </button>
        </div>
        {project.description && <p className="mt-2">{project.description}</p>}
        {project.project_url && (
          <a href={project.project_url} target="_blank" rel="noreferrer">
            Открыть проект
          </a>
        )}
        {renderImages(project)}
      </div>
    </div>
  );

  return (
    <AppLayout title="Лента проектов" navItems={getNavItemsForUser(user, hasRole)}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}

        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <div>
            {topProject && (
              <div className="card border-warning mb-4">
                <div className="card-header bg-warning-subtle">
                  <strong>⭐ Лучший проект недели</strong>
                </div>
                <div className="card-body">{renderProjectCard(topProject)}</div>
              </div>
            )}

            {projects.length === 0 ? (
              <div className="text-muted">Проектов пока нет.</div>
            ) : (
              projects
                .filter((project) => !topProject || project.id !== topProject.id)
                .map((project) => renderProjectCard(project))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};
