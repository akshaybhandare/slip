import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';

describe('Search & Public Shareables Integrations', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  let authCookie: string;
  let bookmark1Id: number;
  let bookmark2Id: number;
  let bookmark3Id: number;
  let tagReactId: number;
  let shareToken: string;
  let tagShareToken: string;

  test('setup user and initial bookmarks', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'searchuser',
      password: 'password123'
    });

    const login = await request(app).post('/api/auth/login').send({
      username: 'searchuser',
      password: 'password123'
    });
    authCookie = login.headers['set-cookie'][0].split(';')[0];

    // Create Bookmark 1
    const b1 = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', authCookie)
      .send({
        url: 'https://react.dev/blog/rsc',
        title: 'React Server Components Deep Dive',
        description: 'Streaming SSR and client transitions in modern web applications.',
        tags: ['react', 'frontend'],
        contentType: 'article'
      });
    bookmark1Id = b1.body.id;
    tagReactId = b1.body.tags.find((t: any) => t.name === 'react').id;

    // Create Bookmark 2
    const b2 = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', authCookie)
      .send({
        url: 'https://sqlite.org/wal.html',
        title: 'SQLite Performance Tuning',
        description: 'Comprehensive guide to Write-Ahead Logging and database concurrency.',
        tags: ['database', 'sqlite'],
        contentType: 'article'
      });
    bookmark2Id = b2.body.id;

    // Create Bookmark 3
    const b3 = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', authCookie)
      .send({
        url: 'https://unraid.net/docker-guide',
        title: 'Docker Deployment on Unraid',
        description: 'Setting up containers with volume mappings and user permissions.',
        tags: ['docker', 'unraid'],
        contentType: 'website'
      });
    bookmark3Id = b3.body.id;
  });

  describe('Full-Text Search (FTS5)', () => {
    test('should search by title term', async () => {
      const response = await request(app)
        .get('/api/bookmarks/search?q=React')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(bookmark1Id);
      expect(response.body[0].title).toContain('React');
    });

    test('should search by description keyword', async () => {
      const response = await request(app)
        .get('/api/bookmarks/search?q=concurrency')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(bookmark2Id);
      expect(response.body[0].title).toContain('SQLite');
    });

    test('should search with multiple keywords', async () => {
      const response = await request(app)
        .get('/api/bookmarks/search?q=docker unraid')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(bookmark3Id);
    });

    test('should return empty list for empty search query', async () => {
      const response = await request(app)
        .get('/api/bookmarks/search?q=')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Public Bookmark & Tag Shareables', () => {
    test('POST /api/share/bookmark/:id should generate shareable token', async () => {
      const response = await request(app)
        .post(`/api/share/bookmark/${bookmark1Id}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body.shareUrl).toBe(`/s/${response.body.token}`);

      shareToken = response.body.token;
    });

    test('GET /api/share/public/bookmark/:token should allow unauthenticated read-only access', async () => {
      const response = await request(app)
        .get(`/api/share/public/bookmark/${shareToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(bookmark1Id);
      expect(response.body.title).toContain('React');
      expect(response.body.tags).toBeDefined();
    });

    test('DELETE /api/share/bookmark/:id should revoke shareable link', async () => {
      const response = await request(app)
        .delete(`/api/share/bookmark/${bookmark1Id}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Share link revoked successfully');

      // Verify public access now returns 404
      const retryPublic = await request(app)
        .get(`/api/share/public/bookmark/${shareToken}`);

      expect(retryPublic.status).toBe(404);
    });

    test('POST /api/share/tag/:id should generate shareable token for tag collection', async () => {
      const response = await request(app)
        .post(`/api/share/tag/${tagReactId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.shareUrl).toBe(`/s/tag/${response.body.token}`);

      tagShareToken = response.body.token;
    });

    test('GET /api/share/public/tag/:token should allow unauthenticated access to tag collection', async () => {
      const response = await request(app)
        .get(`/api/share/public/tag/${tagShareToken}`);

      expect(response.status).toBe(200);
      expect(response.body.tag).toBe('react');
      expect(Array.isArray(response.body.bookmarks)).toBe(true);
      expect(response.body.bookmarks.length).toBe(1);
      expect(response.body.bookmarks[0].id).toBe(bookmark1Id);
    });

    test('DELETE /api/share/tag/:id should revoke tag share link', async () => {
      const response = await request(app)
        .delete(`/api/share/tag/${tagReactId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Tag share link revoked successfully');

      const retryPublicTag = await request(app)
        .get(`/api/share/public/tag/${tagShareToken}`);

      expect(retryPublicTag.status).toBe(404);
    });
  });
});
