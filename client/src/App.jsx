import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import BlogDetailPage from './pages/BlogDetailPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SectionManagementPage from './pages/SectionManagementPage.jsx';

const BlogEditorPage = lazy(() => import('./pages/BlogEditorPage.jsx'));

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<div className="page-loading">Loading…</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/article/:slug/section/:sectionId" element={<BlogDetailPage />} />
          <Route path="/article/:slug" element={<BlogDetailPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/editor" element={<ProtectedRoute><BlogEditorPage /></ProtectedRoute>} />
          <Route path="/admin/editor/:id" element={<ProtectedRoute><BlogEditorPage /></ProtectedRoute>} />
          <Route path="/admin/sections" element={<ProtectedRoute><SectionManagementPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
