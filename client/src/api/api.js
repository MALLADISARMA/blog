const API_ROOT = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || '';
let csrfToken;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function getCsrfToken() {
  const response = await fetch(`${API_ROOT}/api/auth/csrf`, { credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.csrfToken !== 'string') {
    throw new ApiError(data.error || 'Could not get a security token', response.status);
  }
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request(path, options = {}, retryCsrf = true) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('X-CSRF-Token', csrfToken || await getCsrfToken());
  }

  const response = await fetch(`${API_ROOT}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('blog:session-expired'));
    if (response.status === 403 && retryCsrf && /csrf token/i.test(data.error || '')) {
      csrfToken = undefined;
      await getCsrfToken();
      return request(path, options, false);
    }
    throw new ApiError(data.error || 'Request failed', response.status);
  }
  if (path === '/api/auth/login' || path === '/api/auth/logout') csrfToken = undefined;
  return data;
}

export const apiRequest = request;
