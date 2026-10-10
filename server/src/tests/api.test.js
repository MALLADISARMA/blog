import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = 'true';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters';
const testUploadDirectory = await mkdtemp(path.join(tmpdir(), 'personal-blog-test-'));
process.env.UPLOAD_DIR = testUploadDirectory;

const [{ default: app }, { memoryStore }] = await Promise.all([
  import('../app.js'),
  import('../config/database.js'),
]);
const { createSessionMiddleware } = await import('../config/session.js');

let passwordHash;
before(async () => { passwordHash = await bcrypt.hash('correct horse battery staple', 4); });
beforeEach(() => {
  memoryStore.admins.splice(0);
  memoryStore.sections.splice(0);
  memoryStore.blogs.splice(0);
  memoryStore.admins.push({ id: '1', email: 'admin@example.com', password_hash: passwordHash });
});

test('public visitors only see published stories', async () => {
  memoryStore.blogs.push(
    { id: '1', title: 'Public', slug: 'public', excerpt: '', content: 'Visible', status: 'published', sectionId: null, publishedAt: new Date().toISOString() },
    { id: '2', title: 'Private', slug: 'private', excerpt: '', content: 'Hidden', status: 'draft', sectionId: null },
  );
  const response = await request(app).get('/api/blogs').expect(200);
  assert.deepEqual(response.body.posts.map((post) => post.slug), ['public']);
  await request(app).get('/api/blogs/private').expect(404);
});

test('public blog listing supports pagination, search, section filters, and allowlisted sorting', async () => {
  memoryStore.sections.push({ id: '1', name: 'Engineering', slug: 'engineering', parentId: null });
  memoryStore.blogs.push(
    { id: '1', title: 'Alpha', slug: 'alpha', excerpt: '', content: 'Searchable body', status: 'published', sectionId: '1', publishedAt: '2024-01-01T00:00:00.000Z' },
    { id: '2', title: 'Beta', slug: 'beta', excerpt: '', content: 'Other text', status: 'published', sectionId: '1', publishedAt: '2024-02-01T00:00:00.000Z' },
    { id: '3', title: 'Hidden draft', slug: 'hidden-draft', excerpt: '', content: 'Searchable body', status: 'draft', sectionId: '1' },
    { id: '4', title: 'Outside section', slug: 'outside', excerpt: '', content: 'Searchable body', status: 'published', sectionId: null, publishedAt: '2024-03-01T00:00:00.000Z' },
  );

  const page = await request(app).get('/api/blogs?page=2&limit=1&sort=title&order=asc').expect(200);
  assert.deepEqual(page.body.posts.map((post) => post.slug), ['beta']);
  assert.deepEqual(page.body.pagination, { page: 2, limit: 1, total: 3, totalPages: 3 });

  const filtered = await request(app).get('/api/blogs?sectionId=1&search=searchable').expect(200);
  assert.deepEqual(filtered.body.posts.map((post) => post.slug), ['alpha']);
  assert.equal(filtered.body.pagination.total, 1);

  const sectionPosts = await request(app).get('/api/sections/1/blogs').expect(200);
  assert.deepEqual(sectionPosts.body.posts.map((post) => post.slug), ['beta', 'alpha']);
  const tree = await request(app).get('/api/sections/tree').expect(200);
  assert.equal(tree.body.sections[0].name, 'Engineering');
});

test('public blog list rejects invalid pagination and sort fields', async () => {
  await request(app).get('/api/blogs?page=1junk').expect(400);
  await request(app).get('/api/blogs?limit=101').expect(400);
  await request(app).get('/api/blogs?sort=password_hash').expect(400);
  await request(app).get('/api/blogs/invalid%20slug').expect(400);
});

test('admin can log in and create a published story with CSRF protection', async () => {
  const agent = request.agent(app);
  const initialCsrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', initialCsrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  const created = await agent.post('/api/blogs/admin')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ title: 'A new story', content: 'Hello world', status: 'published' })
    .expect(201);
  assert.equal(created.body.post.slug, 'a-new-story');
  await request(app).get('/api/blogs/a-new-story').expect(200);
});

test('rich content is sanitized before it is saved and published', async () => {
  const agent = request.agent(app);
  const initialCsrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', initialCsrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
  const created = await agent.post('/api/admin/blogs')
    .set('X-CSRF-Token', csrf)
    .send({
      title: 'Formatted story',
      content: '<p><strong>Safe</strong><span style="font-weight:700;color:red">Pasted bold</span><script>alert(1)</script><img src="https://example.com/evil.png" onerror="alert(1)"><img src="/uploads/test-file.png"></p>',
      status: 'published',
    })
    .expect(201);

  assert.match(created.body.post.content, /<strong>Safe<\/strong>/);
  assert.match(created.body.post.content, /<strong>Pasted bold<\/strong>/);
  assert.doesNotMatch(created.body.post.content, /script|onerror|example\.com/);
  assert.match(created.body.post.content, /src="\/uploads\/test-file\.png"/);
});

test('a single blog saves and returns editable nested section content and search locations', async () => {
  const agent = request.agent(app);
  const initialCsrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', initialCsrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
  const created = await agent.post('/api/admin/blogs')
    .set('X-CSRF-Token', csrf)
    .send({
      title: 'One complete guide',
      excerpt: 'An introduction to the complete guide.',
      content: '<p>Main introduction</p>',
      status: 'published',
      sections: [{
        title: 'Frameworks',
        content: '<p>Framework overview</p>',
        children: [{
          title: 'ORM',
          content: '<p><strong>Object-relational mapping</strong> details.</p>',
          children: [],
        }],
      }],
    })
    .expect(201);
  const blogId = created.body.post.id;
  const topSection = created.body.post.sections[0];
  const nestedSection = topSection.children[0];
  assert.match(nestedSection.content, /<strong>Object-relational mapping<\/strong>/);

  const publicBlog = await request(app).get('/api/blogs/one-complete-guide').expect(200);
  assert.equal(publicBlog.body.post.sections[0].title, 'Frameworks');
  assert.equal(publicBlog.body.post.sections[0].children[0].title, 'ORM');
  assert.equal(publicBlog.body.post.sections[0].children[0].id, nestedSection.id);

  const search = await request(app).get('/api/blogs?search=ORM').expect(200);
  assert.equal(search.body.posts.length, 1);
  assert.deepEqual(search.body.posts[0].sectionMatches, [{
    id: nestedSection.id,
    title: 'ORM',
    path: 'Frameworks → ORM',
  }]);

  const edited = await agent.put(`/api/admin/blogs/${blogId}`)
    .set('X-CSRF-Token', csrf)
    .send({
      title: 'One complete guide',
      excerpt: 'An introduction to the complete guide.',
      content: '<p>Main introduction</p>',
      status: 'published',
      sections: [{
        ...topSection,
        title: 'Core frameworks',
        children: [{ ...nestedSection, content: '<p>Updated ORM notes.</p>', children: [] }],
      }],
    })
    .expect(200);
  assert.equal(edited.body.post.sections[0].id, topSection.id);
  assert.equal(edited.body.post.sections[0].children[0].id, nestedSection.id);
  assert.equal(edited.body.post.sections[0].title, 'Core frameworks');
  assert.match(edited.body.post.sections[0].children[0].content, /Updated ORM notes/);

  const adminRead = await agent.get(`/api/admin/blogs/${blogId}`).expect(200);
  assert.equal(adminRead.body.post.sections[0].children[0].id, nestedSection.id);
});

test('image uploads require admin and CSRF, validate bytes, and are served publicly', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lJ8AAAAASUVORK5CYII=',
    'base64',
  );
  const agent = request.agent(app);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
  await agent.post('/api/admin/blogs/images')
    .set('X-CSRF-Token', csrf)
    .attach('image', png, { filename: 'tiny.png', contentType: 'image/png' })
    .expect(401);

  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const freshCsrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;
  await agent.post('/api/admin/blogs/images')
    .attach('image', png, { filename: 'tiny.png', contentType: 'image/png' })
    .expect(403);

  const uploaded = await agent.post('/api/admin/blogs/images')
    .set('X-CSRF-Token', freshCsrf)
    .attach('image', png, { filename: 'tiny.png', contentType: 'image/png' })
    .expect(201);
  assert.match(uploaded.body.url, /^\/uploads\/[0-9a-f-]+\.png$/i);
  const served = await request(app).get(uploaded.body.url).expect(200);
  assert.match(served.headers['content-type'], /image\/png/);
  assert.deepEqual(served.body, png);

  await agent.post('/api/admin/blogs/images')
    .set('X-CSRF-Token', freshCsrf)
    .attach('image', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' })
    .expect(415);
});

test('admin publish and unpublish endpoints require authentication and CSRF', async () => {
  memoryStore.blogs.push(
    { id: '3', title: 'Draft', slug: 'draft', excerpt: '', content: 'Draft body', status: 'draft', sectionId: null, publishedAt: null },
  );
  const anonymous = request.agent(app);
  const csrf = await anonymous.get('/api/auth/csrf').expect(200);
  await anonymous.patch('/api/admin/blogs/3/publish')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .expect(401);

  await anonymous.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const freshCsrf = await anonymous.get('/api/auth/csrf').expect(200);
  const published = await anonymous.patch('/api/admin/blogs/3/publish')
    .set('X-CSRF-Token', freshCsrf.body.csrfToken)
    .expect(200);
  assert.equal(published.body.post.status, 'published');
  await request(app).get('/api/blogs/draft').expect(200);

  const unpublishCsrf = await anonymous.get('/api/auth/csrf').expect(200);
  const unpublished = await anonymous.patch('/api/admin/blogs/3/unpublish')
    .set('X-CSRF-Token', unpublishCsrf.body.csrfToken)
    .expect(200);
  assert.equal(unpublished.body.post.status, 'draft');
  await request(app).get('/api/blogs/draft').expect(404);
});

test('login validates email and accepts normalized administrator email', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);

  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: 'not-an-email', password: 'correct horse battery staple' })
    .expect(400);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: '   ', password: 'correct horse battery staple' })
    .expect(400);
  const response = await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: ' ADMIN@EXAMPLE.COM ', password: 'correct horse battery staple' })
    .expect(200);
  assert.deepEqual(response.body.admin, { id: '1', email: 'admin@example.com' });
  const currentUser = await agent.get('/api/auth/me').expect(200);
  assert.deepEqual(currentUser.body.admin, { id: '1', email: 'admin@example.com' });
});

test('login returns a generic error for invalid credentials', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: 'admin@example.com' })
    .expect(400);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ password: 'correct horse battery staple' })
    .expect(400);
  const response = await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'incorrect password' })
    .expect(401);
  assert.deepEqual(response.body, { error: 'Invalid email or password' });
});

test('admin provisioning stores bcrypt hashes and refuses a second administrator', async () => {
  const { adminRepository } = await import('../repositories/adminRepository.js');
  const hash = await bcrypt.hash('a different long password', 4);
  await assert.rejects(adminRepository.create('second@example.com', hash), /Only one administrator/);
  assert.equal(await bcrypt.compare('correct horse battery staple', memoryStore.admins[0].password_hash), true);
  assert.equal(memoryStore.admins[0].password_hash.startsWith('$2'), true);
});

test('anonymous writes to all protected content endpoints are rejected', async () => {
  const visitor = request.agent(app);
  const csrf = await visitor.get('/api/auth/csrf').expect(200);
  const token = csrf.body.csrfToken;
  assert.equal(token.length > 0, true);
  await visitor.post('/api/admin/blogs').set('X-CSRF-Token', token).send({}).expect(401);
  await visitor.put('/api/admin/blogs/1').set('X-CSRF-Token', token).send({}).expect(401);
  await visitor.delete('/api/admin/blogs/1').set('X-CSRF-Token', token).expect(401);
  await visitor.patch('/api/admin/blogs/1/publish').set('X-CSRF-Token', token).expect(401);
  await visitor.patch('/api/admin/blogs/1/unpublish').set('X-CSRF-Token', token).expect(401);
  await visitor.post('/api/admin/sections').set('X-CSRF-Token', token).send({}).expect(401);
  await visitor.put('/api/admin/sections/1').set('X-CSRF-Token', token).send({}).expect(401);
  await visitor.delete('/api/admin/sections/1').set('X-CSRF-Token', token).expect(401);
});

test('administrator can complete a create, edit, publish, section, and delete workflow', async () => {
  const agent = request.agent(app);
  const initialCsrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', initialCsrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const csrf = (await agent.get('/api/auth/csrf').expect(200)).body.csrfToken;

  const section = await agent.post('/api/admin/sections')
    .set('X-CSRF-Token', csrf)
    .send({ name: 'Engineering' })
    .expect(201);
  const sectionId = section.body.section.id;
  const created = await agent.post('/api/admin/blogs')
    .set('X-CSRF-Token', csrf)
    .send({ title: 'Workflow draft', content: 'First version', status: 'draft', sectionId })
    .expect(201);
  const postId = created.body.post.id;
  await request(app).get('/api/blogs/workflow-draft').expect(404);

  const updated = await agent.put(`/api/admin/blogs/${postId}`)
    .set('X-CSRF-Token', csrf)
    .send({ title: 'Workflow published', content: 'Updated version', status: 'published', sectionId })
    .expect(200);
  assert.equal(updated.body.post.status, 'published');
  assert.equal((await request(app).get('/api/blogs/workflow-published').expect(200)).body.post.content, 'Updated version');
  await agent.delete(`/api/admin/sections/${sectionId}`).set('X-CSRF-Token', csrf).expect(409);
  await agent.delete(`/api/admin/blogs/${postId}`).set('X-CSRF-Token', csrf).expect(204);
  await agent.delete(`/api/admin/sections/${sectionId}`).set('X-CSRF-Token', csrf).expect(204);
  await request(app).get('/api/blogs/workflow-published').expect(404);
});

test('CSRF failures return 403 and logout invalidates the session', async () => {
  const agent = request.agent(app);
  const csrfResponse = await agent.get('/api/auth/csrf').expect(200);
  assert.match(csrfResponse.headers['set-cookie'][0], /^blog\.csrf=s%3A/);
  assert.equal(csrfResponse.headers['cache-control'], 'no-store');
  const login = await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrfResponse.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const authenticatedCookie = login.headers['set-cookie'][0].split(';')[0];
  assert.match(authenticatedCookie, /^blog\.sid=/);

  const missingToken = await agent.post('/api/sections/admin')
    .send({ name: 'Missing CSRF' })
    .expect(403);
  assert.equal(missingToken.body.error, 'Invalid or missing CSRF token');

  const freshCsrf = await agent.get('/api/auth/csrf').expect(200);
  const logout = await agent.post('/api/auth/logout')
    .set('X-CSRF-Token', freshCsrf.body.csrfToken)
    .expect(204);
  assert.equal(logout.status, 204);
  const currentUser = await agent.get('/api/auth/me').expect(200);
  assert.deepEqual(currentUser.body, { admin: null });
  const protectedResource = await agent.get('/api/blogs/admin/all').expect(401);
  assert.equal(protectedResource.body.error, 'Authentication required');
});

test('production refuses in-memory session storage', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMemoryMode = process.env.USE_MEMORY_DB;
  try {
    process.env.NODE_ENV = 'production';
    process.env.USE_MEMORY_DB = 'true';
    assert.throws(
      () => createSessionMiddleware(),
      /In-memory sessions are not allowed in production/,
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalMemoryMode === undefined) delete process.env.USE_MEMORY_DB;
    else process.env.USE_MEMORY_DB = originalMemoryMode;
  }
});

test('section tree rejects a cyclic parent move and protects admin writes', async () => {
  const agent = request.agent(app);
  const csrf = await agent.get('/api/auth/csrf').expect(200);
  await agent.post('/api/sections/admin')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ name: 'Private section' })
    .expect(401);

  await agent.post('/api/auth/login')
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ email: 'admin@example.com', password: 'correct horse battery staple' })
    .expect(200);
  const freshCsrf = await agent.get('/api/auth/csrf').expect(200);
  const parent = await agent.post('/api/admin/sections')
    .set('X-CSRF-Token', freshCsrf.body.csrfToken)
    .send({ name: 'Parent' })
    .expect(201);
  const child = await agent.post('/api/sections/admin')
    .set('X-CSRF-Token', freshCsrf.body.csrfToken)
    .send({ name: 'Child', parentId: parent.body.section.id })
    .expect(201);
  await agent.put(`/api/sections/admin/${parent.body.section.id}`)
    .set('X-CSRF-Token', freshCsrf.body.csrfToken)
    .send({ name: 'Parent', parentId: child.body.section.id })
    .expect(400);
  const tree = await request(app).get('/api/sections').expect(200);
  assert.equal(tree.body.sections[0].children[0].name, 'Child');
});

after(async () => {
  const { pool } = await import('../config/database.js');
  await pool.end();
  await rm(testUploadDirectory, { recursive: true, force: true });
});
