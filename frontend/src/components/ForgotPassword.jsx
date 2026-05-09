import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить запрос.');
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
              <h2 className="card-title text-center mb-4">Восстановление пароля</h2>

              {submitted ? (
                <>
                  <div className="alert alert-success">
                    Если такой email зарегистрирован, на него отправлено письмо со ссылкой
                    для сброса пароля. Ссылка действительна 2 часа.
                  </div>
                  <div className="text-center">
                    <Link to="/login" className="btn btn-link">К форме входа</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted">
                    Укажите email, который вы передали администратору. На него придёт ссылка
                    для задания нового пароля.
                  </p>

                  {error && <div className="alert alert-danger">{error}</div>}

                  <form onSubmit={handleSubmit}>
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                      />
                    </div>

                    <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                      {loading ? 'Отправляем…' : 'Отправить ссылку'}
                    </button>
                  </form>

                  <div className="text-center mt-3">
                    <Link to="/login" className="text-decoration-none small">Назад ко входу</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
