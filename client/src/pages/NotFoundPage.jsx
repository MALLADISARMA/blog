import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout.jsx';

export default function NotFoundPage() {
  return (
    <Layout>
      <section className="form-panel">
        <p className="eyebrow">404</p>
        <h1>Page not found</h1>
        <Link className="text-link" to="/">Return home →</Link>
      </section>
    </Layout>
  );
}
