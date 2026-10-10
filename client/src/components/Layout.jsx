import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export function Layout({ children }) {
  const { admin } = useAuth();
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">Fieldnotes<span>.</span></Link>
        <nav aria-label="Main navigation">
          <Link to="/">Journal</Link>
          {admin ? <Link to="/admin">Dashboard</Link> : <Link to="/login">Admin</Link>}
        </nav>
      </header>
      <main className="page">{children}</main>
      <footer>Thoughts, stories, and things worth keeping.</footer>
    </>
  );
}
