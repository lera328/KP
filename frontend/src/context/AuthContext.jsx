import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is already logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (token) {
          api.setToken(token);
          const profile = await api.getProfile();
          setUser(profile);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        localStorage.removeItem('access_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (identifier, password) => {
    setError(null);
    try {
      const response = await api.login(identifier, password);
      if (!response?.access) {
        throw new Error('Сервер не вернул токен доступа');
      }

      api.setToken(response.access);
      const profile = await api.getProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      api.clearToken();
      setUser(null);
    }
  };

  const hasRole = (roleCode) => {
    if (!user) return false;
    return (
      user.is_superuser ||
      user.roles?.some((role) => (typeof role === 'string' ? role === roleCode : role?.code === roleCode))
    );
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
      return profile;
    } catch (err) {
      console.error('Profile refresh failed:', err);
      return null;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    hasRole,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
