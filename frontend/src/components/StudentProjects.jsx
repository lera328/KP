import { useEffect, useState } from 'react';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';
import { useAuth } from '../context/AuthContext';

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('ru-RU');
};

export const StudentProjects = () => {
  const { user } = useAuth();

  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getStudentProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError(loadError.message || 'Не удалось загрузить проекты.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (photos.length < 1 || photos.length > 5) {
        setError('Нужно добавить от 1 до 5 фото.');
        setSaving(false);
        return;
      }

      await api.createStudentProject({
        title: title.trim(),
        description: description.trim(),
        project_url: projectUrl.trim(),
        photos,
      });
      setSuccess('Проект добавлен в портфолио.');
      setTitle('');
      setDescription('');
      setProjectUrl('');
      setPhotos([]);
      await loadProjects();
    } catch (saveError) {
      setError(saveError.message || 'Не удалось добавить проект.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="KiberOne — Ученик" navItems={studentNavItems}>
      <div>
        {error && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="row g-4">
          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <strong>Добавить проект</strong>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label">Название проекта</label>
                    <input
                      className="form-control"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      maxLength={200}
                      disabled={saving}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Описание</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Ссылка на проект (необязательно)</label>
                    <input
                      className="form-control"
                      type="url"
                      value={projectUrl}
                      onChange={(e) => setProjectUrl(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Фото проекта (1-5)</label>
                    <input
                      className="form-control"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => setPhotos(Array.from(e.target.files || []))}
                      disabled={saving}
                    />
                    {photos.length > 0 && (
                      <div className="form-text">Выбрано фото: {photos.length}</div>
                    )}
                  </div>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={saving || !title.trim()}>
                    {saving ? 'Сохранение...' : 'Добавить'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <div className="col-lg-7">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <strong>Лента проектов</strong>
                <button className="btn btn-outline-secondary btn-sm" onClick={loadProjects} disabled={loading}>
                  Обновить
                </button>
              </div>
              <div className="card-body p-0">
                {loading ? (
                  <div className="p-3">Загрузка...</div>
                ) : projects.length === 0 ? (
                  <div className="p-3 text-muted">Проектов пока нет.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {projects.map((project) => (
                      <li key={project.id} className="list-group-item">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">{project.title}</div>
                            {project.description && <div className="text-muted small">{project.description}</div>}
                            {project.project_url && (
                              <div>
                                <a href={project.project_url} target="_blank" rel="noreferrer">
                                  Открыть проект
                                </a>
                              </div>
                            )}
                            {Array.isArray(project.images) && project.images.length > 0 && (
                              <div className="mt-2 d-flex flex-wrap gap-2">
                                {project.images.map((image) => (
                                  <img
                                    key={image.id}
                                    src={image.url}
                                    alt=""
                                    style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 6 }}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-muted small">{formatDateTime(project.created_at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
