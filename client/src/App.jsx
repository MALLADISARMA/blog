import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import BlogDetailPage from './pages/BlogDetailPage.jsx';
import BlogEditorPage from './pages/BlogEditorPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import SectionManagementPage from './pages/SectionManagementPage.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/article/:slug" element={<BlogDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/editor" element={<ProtectedRoute><BlogEditorPage /></ProtectedRoute>} />
        <Route path="/admin/editor/:id" element={<ProtectedRoute><BlogEditorPage /></ProtectedRoute>} />
        <Route path="/admin/sections" element={<ProtectedRoute><SectionManagementPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
