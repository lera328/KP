import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const LoginForm = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const profile = await login(identifier, password);
      if (profile?.must_change_password) {
        navigate('/force-change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mt-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow">
            <div className="card-body">
              <h2 className="card-title text-center mb-4">KiberOne</h2>
              <p className="text-muted text-center mb-4">
                Вход выполняется по учетной записи, созданной администратором.
              </p>
              
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="identifier" className="form-label">Эл. почта или имя пользователя</label>
                  <input
                    type="text"
                    className="form-control"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Пароль</label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? 'Входим...' : 'Войти'}
                </button>
              </form>

              <div className="text-center mt-3">
                <Link to="/forgot-password" className="text-decoration-none small">
                  Забыли пароль?
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
