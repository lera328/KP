import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute - restricts access to authenticated users
 */
export const ProtectedRoute = ({ children, allowDuringForceChange = false }) => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="container text-center mt-5">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_change_password && !allowDuringForceChange) {
    return <Navigate to="/force-change-password" replace />;
  }

  return children;
};

/**
 * RoleRoute - restricts access by user role
 */
export const RoleRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, loading, hasRole, user } = useAuth();

  if (loading) {
    return <div className="container text-center mt-5">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.must_change_password) {
    return <Navigate to="/force-change-password" replace />;
  }

  if (!hasRole(requiredRole)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};
