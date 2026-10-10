import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.USE_MEMORY_DB = 'true';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-characters';

const [{ default: app }, { memoryStore }] = await Promise.all([
  import('../app.js'),
  import('../config/database.js'),
]);

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
  const parent = await agent.post('/api/sections/admin')
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
});
