import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, ApiError } from './api.js';

test('state-changing API requests include cookies and fetch a CSRF token', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/api/auth/csrf')) {
      return new Response(JSON.stringify({ csrfToken: 'test-csrf-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ created: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await apiRequest('/api/admin/blogs', {
    method: 'POST',
    body: JSON.stringify({ title: 'Test' }),
  });

  assert.deepEqual(result, { created: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(calls[1].options.headers.get('X-CSRF-Token'), 'test-csrf-token');
  assert.equal(calls[1].options.headers.get('Content-Type'), 'application/json');
});

test('multipart requests include CSRF but let fetch set the boundary content type', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/api/auth/csrf')) {
      return new Response(JSON.stringify({ csrfToken: 'upload-csrf-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ url: '/uploads/image.png' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const formData = new FormData();
  formData.append('image', new Blob(['image']), 'image.png');
  await apiRequest('/api/admin/blogs/images', { method: 'POST', body: formData });

  const uploadCall = calls.find(({ url }) => url.endsWith('/api/admin/blogs/images'));
  assert.ok(uploadCall);
  assert.ok(uploadCall.options.headers.get('X-CSRF-Token'));
  assert.equal(uploadCall.options.headers.has('Content-Type'), false);
  assert.equal(uploadCall.options.body, formData);
});

test('API errors preserve the response status and server message', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Invalid request' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    apiRequest('/api/blogs'),
    (error) => error instanceof ApiError && error.status === 400 && error.message === 'Invalid request',
  );
});

test('expired-session responses notify the auth context', async () => {
  let eventName;
  globalThis.window = { dispatchEvent: (event) => { eventName = event.type; } };
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(apiRequest('/api/admin/blogs'), /Authentication required/);
  assert.equal(eventName, 'blog:session-expired');
  delete globalThis.window;
});
