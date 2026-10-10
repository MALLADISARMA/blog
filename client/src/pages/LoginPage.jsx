import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout.jsx';
import { useAuth } from '../hooks/useAuth.js';

export default function LoginPage() {
  const { admin, login, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <Layout><output>Checking session…</output></Layout>;
  if (admin) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      const destination = location.state?.from?.pathname || '/admin';
      navigate(destination.startsWith('/admin') ? destination : '/admin', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <section className="form-panel narrow">
        <p className="eyebrow">Private area</p>
        <h1>Administrator sign in</h1>
        <form onSubmit={submit}>
          <label htmlFor="login-email"><span>Email</span>
            <input id="login-email" name="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label htmlFor="login-password"><span>Password</span>
            <input id="login-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </section>
    </Layout>
  );
}
