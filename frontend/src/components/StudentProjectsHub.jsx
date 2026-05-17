import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { AppLayout, studentNavItems } from './AppLayout';

const formatDate = (v) =>
  v
    ? new Date(v).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

export const StudentProjectsHub = () => {
  const [params, setParams] = useSearchParams();
  const initialTab = params.get('tab') === 'mine' ? 'mine' : 'feed';
  const [tab, setTab] = useState(initialTab);
  const [showAddModal, setShowAddModal] = useState(params.get('new') === '1');

  const [feed, setFeed] = useState({ projects: [], top_project: null });
  const [myProjects, setMyProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFeed = async () => {
    try {
      const data = await api.getProjectsFeed();
      setFeed({
        projects: Array.isArray(data?.projects) ? data.projects : [],
        top_project: data?.top_project || null,
      });
    } catch (e) {
      setError(e.message || 'Не удалось загрузить ленту.');
    }
  };

  const loadMine = async () => {
    try {
      const data = await api.getStudentProjects();
      setMyProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Не удалось загрузить твои проекты.');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadFeed(), loadMine()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (params.has('new') || params.has('tab')) {
      const next = new URLSearchParams(params);
      next.delete('new');
      next.delete('tab');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLikeToggle = async (project) => {
    try {
      const response = project.liked_by_me
        ? await api.unlikeProject(project.id)
        : await api.likeProject(project.id);
      const updateList = (list) =>
        list.map((p) =>
          p.id === project.id
            ? {
                ...p,
                liked_by_me: !project.liked_by_me,
                likes_count: response?.likes_count ?? p.likes_count,
                likes_week: response?.likes_week ?? p.likes_week,
              }
            : p,
        );
      setFeed((f) => ({
        projects: updateList(f.projects),
        top_project:
          f.top_project && f.top_project.id === project.id
            ? {
                ...f.top_project,
                liked_by_me: !project.liked_by_me,
                likes_count: response?.likes_count ?? f.top_project.likes_count,
                likes_week: response?.likes_week ?? f.top_project.likes_week,
              }
            : f.top_project,
      }));
    } catch (e) {
      setError(e.message || 'Не удалось обновить лайк.');
    }
  };

  return (
    <AppLayout title="КиберШкола" navItems={studentNavItems} kidMode>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-2">
        <h1 className="fw-semibold mb-0" style={{ fontSize: '2rem' }}>
          Проекты
        </h1>
        <button
          type="button"
          className="btn btn-dark rounded-pill px-4 py-2 fw-semibold"
          onClick={() => setShowAddModal(true)}
        >
          Добавить проект
        </button>
      </div>

      {error && <div className="alert alert-danger rounded-3">{error}</div>}
      {success && <div className="alert alert-success rounded-3">{success}</div>}

      <div className="mb-3 d-flex gap-2 flex-wrap">
        <TabButton active={tab === 'feed'} onClick={() => setTab('feed')} label="Лента" />
        <TabButton
          active={tab === 'mine'}
          onClick={() => setTab('mine')}
          label={`Мои проекты${myProjects.length ? ` (${myProjects.length})` : ''}`}
        />
      </div>

      {loading ? (
        <ProjectsSkeleton />
      ) : tab === 'feed' ? (
        <FeedView feed={feed} onLikeToggle={handleLikeToggle} />
      ) : (
        <MineView projects={myProjects} onAddClick={() => setShowAddModal(true)} />
      )}

      {showAddModal && (
        <AddProjectModal
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            setShowAddModal(false);
            setSuccess('Проект добавлен в портфолио.');
            await loadAll();
            setTab('mine');
            setTimeout(() => setSuccess(''), 4000);
          }}
        />
      )}
    </AppLayout>
  );
};

const TabButton = ({ active, onClick, label }) => (
  <button
    type="button"
    className={`btn rounded-pill px-3 py-2 ${
      active ? 'btn-dark text-white' : 'btn-light border'
    }`}
    style={{ fontSize: '0.95rem' }}
    onClick={onClick}
  >
    {label}
  </button>
);

const FeedView = ({ feed, onLikeToggle }) => {
  const otherProjects = useMemo(() => {
    const top = feed.top_project;
    return feed.projects.filter((p) => !top || p.id !== top.id);
  }, [feed]);

  if (!feed.top_project && otherProjects.length === 0) {
    return <EmptyState text="В ленте пока нет проектов. Стань первым — поделись своей работой." />;
  }

  return (
    <>
      {feed.top_project && (
        <div className="mb-4">
          <div className="text-muted small text-uppercase mb-2" style={{ letterSpacing: 0.5 }}>
            Лучший проект недели
          </div>
          <ProjectCard project={feed.top_project} onLikeToggle={onLikeToggle} highlight />
        </div>
      )}

      <div className="row g-3">
        {otherProjects.map((p) => (
          <div key={p.id} className="col-md-6 col-xl-4">
            <ProjectCard project={p} onLikeToggle={onLikeToggle} />
          </div>
        ))}
      </div>
    </>
  );
};

const MineView = ({ projects, onAddClick }) => {
  if (projects.length === 0) {
    return (
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body text-center py-5">
          <div className="text-muted mb-3">
            У тебя пока нет проектов. Самое время создать первый.
          </div>
          <button className="btn btn-dark rounded-pill px-4" onClick={onAddClick}>
            Добавить проект
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-3">
      {projects.map((p) => (
        <div key={p.id} className="col-md-6 col-xl-4">
          <ProjectCard project={p} compact />
        </div>
      ))}
    </div>
  );
};

const ProjectCard = ({ project, onLikeToggle, highlight = false, compact = false }) => {
  const cover =
    Array.isArray(project.images) && project.images.length > 0 ? project.images[0] : null;
  const moreImages = Array.isArray(project.images) ? project.images.slice(1, 4) : [];

  return (
    <div
      className="card border-0 shadow-sm rounded-4 h-100 overflow-hidden"
      style={highlight ? { boxShadow: '0 0 0 2px #1f2937, 0 1px 2px rgba(0,0,0,0.05)' } : {}}
    >
      {cover ? (
        <div
          style={{
            backgroundImage: `url(${cover.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: 180,
          }}
        />
      ) : (
        <div
          style={{
            height: 180,
            background: '#f1f3f5',
          }}
        />
      )}
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
          <div className="fw-semibold flex-grow-1">{project.title}</div>
          {!compact && onLikeToggle && (
            <button
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${
                project.liked_by_me ? 'btn-dark text-white' : 'btn-light border'
              }`}
              onClick={() => onLikeToggle(project)}
              title="Лайк"
              style={{ fontSize: '0.85rem' }}
            >
              ♥ {project.likes_count || 0}
            </button>
          )}
          {compact && (
            <span
              className="badge rounded-pill"
              style={{ background: '#f1f3f5', color: '#475569', fontWeight: 500 }}
            >
              ♥ {project.likes_count || 0}
            </span>
          )}
        </div>
        {project.student_name && !compact && (
          <div className="text-muted small mb-1">{project.student_name}</div>
        )}
        <div className="text-muted small mb-2">{formatDate(project.created_at)}</div>
        {project.description && (
          <div className="small mb-2" style={{ whiteSpace: 'pre-wrap' }}>
            {project.description.length > 160
              ? project.description.slice(0, 160) + '…'
              : project.description}
          </div>
        )}
        {project.project_url && (
          <a
            className="small d-inline-block mb-2"
            href={project.project_url}
            target="_blank"
            rel="noreferrer"
          >
            Открыть проект →
          </a>
        )}
        {moreImages.length > 0 && (
          <div className="d-flex gap-1 mt-2">
            {moreImages.map((img) => (
              <img
                key={img.id}
                src={img.url}
                alt=""
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }}
              />
            ))}
          </div>
        )}
        {Array.isArray(project.files) && project.files.length > 0 && (
          <div className="mt-2 small">
            <div className="text-muted">Файлы</div>
            <ul className="list-unstyled mb-0">
              {project.files.map((f) => (
                <li key={f.id} className="text-truncate" title={f.name}>
                  <a href={f.url} download={f.name} target="_blank" rel="noreferrer">
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

const AddProjectModal = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [photos, setPhotos] = useState([]);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (photos.length < 1 || photos.length > 5) {
      setErr('Выбери от 1 до 5 фото проекта.');
      return;
    }
    setSaving(true);
    try {
      await api.createStudentProject({
        title: title.trim(),
        description: description.trim(),
        project_url: projectUrl.trim(),
        photos,
        files,
      });
      onCreated();
    } catch (e2) {
      setErr(e2.message || 'Не удалось добавить проект.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content rounded-4 border-0 shadow-lg">
          <div className="modal-header border-0">
            <h5 className="modal-title fw-semibold">Новый проект</h5>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={saving}
            />
          </div>
          <form onSubmit={submit}>
            <div className="modal-body pt-0">
              {err && <div className="alert alert-danger rounded-3">{err}</div>}
              <div className="mb-3">
                <label className="form-label">Название</label>
                <input
                  className="form-control rounded-3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Например: Мой первый сайт"
                  disabled={saving}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Описание</label>
                <textarea
                  className="form-control rounded-3"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Что ты сделал? Что было сложным?"
                  disabled={saving}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Ссылка (необязательно)</label>
                <input
                  className="form-control rounded-3"
                  type="url"
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  placeholder="https://"
                  disabled={saving}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Фото проекта (1–5)</label>
                <input
                  className="form-control rounded-3"
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
              <div className="mb-3">
                <label className="form-label">Файлы (любые, до 10 шт., до 25 МБ)</label>
                <input
                  className="form-control rounded-3"
                  type="file"
                  multiple
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  disabled={saving}
                />
                {files.length > 0 && (
                  <div className="form-text">
                    {files.length} файл(ов): {files.map((f) => f.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer border-0">
              <button
                type="button"
                className="btn btn-light border rounded-pill px-4"
                onClick={onClose}
                disabled={saving}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-dark rounded-pill px-4"
                disabled={saving || !title.trim()}
              >
                {saving ? 'Сохранение…' : 'Опубликовать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="card border-0 shadow-sm rounded-4">
    <div className="card-body text-center py-5 text-muted">{text}</div>
  </div>
);

const ProjectsSkeleton = () => (
  <div className="row g-3">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div className="col-md-6 col-xl-4" key={i}>
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="kid-skeleton" style={{ height: 180, borderRadius: 0 }} />
          <div className="card-body">
            <div className="kid-skeleton mb-2" style={{ height: 18, width: '70%' }} />
            <div className="kid-skeleton mb-2" style={{ height: 12, width: '40%' }} />
            <div className="kid-skeleton" style={{ height: 12, width: '90%' }} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export default StudentProjectsHub;
