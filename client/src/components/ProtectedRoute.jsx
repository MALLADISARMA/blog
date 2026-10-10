import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function ProtectedRoute({ children }) {
  const { admin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <output className="page-loading">Checking administrator session…</output>;
  if (!admin) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}
