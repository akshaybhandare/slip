import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';
import fs from 'fs';
import path from 'path';
import { CACHE_DIR } from '../services/thumbnail';

describe('Bookmark CRUD & Local Thumbnail Cache Integrations', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  let user1Cookie: string;
  let user2Cookie: string;
  let createdBookmarkId: number;

  test('setup test users', async () => {
    await request(app).post('/api/auth/register').send({
      username: 'user1',
      password: 'password123'
    });

    const login1 = await request(app).post('/api/auth/login').send({
      username: 'user1',
      password: 'password123'
    });
    user1Cookie = login1.headers['set-cookie'][0].split(';')[0];

    await request(app).post('/api/auth/register').set('Cookie', user1Cookie).send({
      username: 'user2',
      password: 'password123'
    });

    const login2 = await request(app).post('/api/auth/login').send({
      username: 'user2',
      password: 'password123'
    });
    user2Cookie = login2.headers['set-cookie'][0].split(';')[0];
  });

  test('POST /api/bookmarks should create a bookmark with tags in a transaction', async () => {
    const response = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', user1Cookie)
      .send({
        url: 'https://news.ycombinator.com',
        title: 'Hacker News',
        description: 'Tech news aggregator',
        tags: ['tech', 'news', 'hacker'],
        contentType: 'website'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Hacker News');
    expect(response.body.tags).toBeDefined();
    expect(response.body.tags.map((t: any) => t.name)).toEqual(expect.arrayContaining(['tech', 'news', 'hacker']));

    createdBookmarkId = response.body.id;
  });

  test('GET /api/bookmarks should enforce strict user data isolation', async () => {
    const user1Res = await request(app)
      .get('/api/bookmarks')
      .set('Cookie', user1Cookie);

    expect(user1Res.status).toBe(200);
    expect(user1Res.body.length).toBe(1);
    expect(user1Res.body[0].id).toBe(createdBookmarkId);

    const user2Res = await request(app)
      .get('/api/bookmarks')
      .set('Cookie', user2Cookie);

    expect(user2Res.status).toBe(200);
    expect(user2Res.body.length).toBe(0);
  });

  test('GET /api/bookmarks/tags should list user-scoped tags with counts', async () => {
    const response = await request(app)
      .get('/api/bookmarks/tags')
      .set('Cookie', user1Cookie);

    expect(response.status).toBe(200);
    expect(response.body.length).toBe(3);
    expect(response.body.map((t: any) => t.name)).toEqual(expect.arrayContaining(['tech', 'news', 'hacker']));
  });

  test('PUT /api/bookmarks/:id should update title and replace tags cleanly', async () => {
    const response = await request(app)
      .put(`/api/bookmarks/${createdBookmarkId}`)
      .set('Cookie', user1Cookie)
      .send({
        title: 'HN Homepage',
        tags: ['tech', 'startups']
      });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe('HN Homepage');
    expect(response.body.tags.map((t: any) => t.name)).toEqual(expect.arrayContaining(['tech', 'startups']));
    expect(response.body.tags.map((t: any) => t.name)).not.toContain('news');
  });

  test('PUT /api/bookmarks/:id should reject update from unauthorized user', async () => {
    const response = await request(app)
      .put(`/api/bookmarks/${createdBookmarkId}`)
      .set('Cookie', user2Cookie)
      .send({
        title: 'Hacked Title'
      });

    expect(response.status).toBe(404);
  });

  test('PUT /api/bookmarks/:id/note should update personal sticky note', async () => {
    const response = await request(app)
      .put(`/api/bookmarks/${createdBookmarkId}/note`)
      .set('Cookie', user1Cookie)
      .send({
        note: 'Important architectural reference for second brain project.'
      });

    expect(response.status).toBe(200);
    expect(response.body.personal_note).toBe('Important architectural reference for second brain project.');
  });

  test('POST /api/bookmarks/:id/highlights should save text highlight', async () => {
    const response = await request(app)
      .post(`/api/bookmarks/${createdBookmarkId}/highlights`)
      .set('Cookie', user1Cookie)
      .send({
        text: 'In WAL mode, readers do not block writers.',
        color: 'yellow',
        note: 'Key insight for concurrency'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.text).toBe('In WAL mode, readers do not block writers.');
    expect(response.body.color).toBe('yellow');

    const highlightId = response.body.id;

    // List highlights
    const listRes = await request(app)
      .get(`/api/bookmarks/${createdBookmarkId}/highlights`)
      .set('Cookie', user1Cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(1);
    expect(listRes.body[0].id).toBe(highlightId);

    // Delete highlight
    const delRes = await request(app)
      .delete(`/api/bookmarks/${createdBookmarkId}/highlights/${highlightId}`)
      .set('Cookie', user1Cookie);

    expect(delRes.status).toBe(200);
  });

  test('GET /api/cache/:filename should block directory traversal attempts', async () => {
    const response = await request(app)
      .get('/api/cache/..%2f..%2f..%2fpackage.json');

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Invalid or unsafe filename/);
  });

  test('DELETE /api/bookmarks/:id should delete bookmark and clear tags', async () => {
    const response = await request(app)
      .delete(`/api/bookmarks/${createdBookmarkId}`)
      .set('Cookie', user1Cookie);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Bookmark deleted successfully');

    const verifyGet = await request(app)
      .get(`/api/bookmarks/${createdBookmarkId}`)
      .set('Cookie', user1Cookie);

    expect(verifyGet.status).toBe(404);
  });

  describe('Local Image Bookmark Uploads & Shortcut API', () => {
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const validPngBuffer = Buffer.from(validPngBase64, 'base64');
    let apiKey: string;

    test('generate API key for user1', async () => {
      const res = await request(app)
        .post('/api/auth/apikey')
        .set('Cookie', user1Cookie)
        .send({ name: 'iOS Shortcut Test Key' });

      expect(res.status).toBe(201);
      expect(res.body.apiKey).toMatch(/^slip_/);
      apiKey = res.body.apiKey;
    });

    test('POST /api/bookmarks/upload should create bookmark from Base64 JSON payload', async () => {
      const response = await request(app)
        .post('/api/bookmarks/upload')
        .set('Cookie', user1Cookie)
        .send({
          image_data: `data:image/png;base64,${validPngBase64}`,
          filename: 'inspiration-shot.png',
          title: 'UI Inspiration Shot',
          description: 'A great minimal UI reference',
          tags: ['design', 'inspiration']
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content_type).toBe('image');
      expect(response.body.title).toBe('UI Inspiration Shot');
      expect(response.body.image_path).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.png$/);
      expect(response.body.tags).toEqual(expect.arrayContaining(['design', 'inspiration', 'image']));

      // Verify image file exists and can be retrieved via /api/cache/:filename
      const cacheFilename = response.body.image_path.replace('/api/cache/', '');
      const cacheRes = await request(app).get(`/api/cache/${cacheFilename}`);
      expect(cacheRes.status).toBe(200);
      expect(cacheRes.headers['content-type']).toMatch(/image\/png/);
    });

    test('POST /api/bookmarks/upload should create bookmark from raw binary buffer using Bearer API Key (iOS Shortcut flow)', async () => {
      const response = await request(app)
        .post('/api/bookmarks/upload')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Content-Type', 'image/png')
        .set('X-Filename', 'shortcut-camera-upload.png')
        .set('X-Title', 'Shortcut Camera Photo')
        .set('X-Tags', 'mobile, photos')
        .send(validPngBuffer);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content_type).toBe('image');
      expect(response.body.title).toBe('Shortcut Camera Photo');
      expect(response.body.image_path).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.png$/);
      expect(response.body.tags).toEqual(expect.arrayContaining(['mobile', 'photos', 'image']));
    });

    test('POST /api/bookmarks should forward base64 image_data seamlessly when url is omitted', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${apiKey}`)
        .send({
          imageData: validPngBase64,
          filename: 'forwarded-image.png',
          title: 'Forwarded Image Test'
        });

      expect(response.status).toBe(201);
      expect(response.body.content_type).toBe('image');
      expect(response.body.title).toBe('Forwarded Image Test');
      expect(response.body.image_path).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.png$/);
    });

    test('POST /api/bookmarks should accept raw binary image directly to unified endpoint', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Content-Type', 'image/png')
        .set('X-Filename', 'unified-endpoint-photo.png')
        .set('X-Title', 'Unified Photo')
        .send(validPngBuffer);

      expect(response.status).toBe(201);
      expect(response.body.content_type).toBe('image');
      expect(response.body.title).toBe('Unified Photo');
      expect(response.body.image_path).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.png$/);
    });


    test('POST /api/bookmarks/upload should reject invalid non-image non-pdf file buffer', async () => {
      const invalidBuffer = Buffer.from('THIS_IS_NOT_AN_IMAGE_OR_PDF_FILE');
      const response = await request(app)
        .post('/api/bookmarks/upload')
        .set('Authorization', `Bearer ${apiKey}`)
        .set('Content-Type', 'application/octet-stream')
        .send(invalidBuffer);

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Unsupported file format/);
    });

    test('POST /api/bookmarks/upload should create document bookmark for PDF files (magic bytes validated)', async () => {
      // Valid minimal PDF buffer starting with %PDF-1.4
      const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const validPdfBase64 = validPdfBuffer.toString('base64');

      const response = await request(app)
        .post('/api/bookmarks/upload')
        .set('Cookie', user1Cookie)
        .send({
          file_data: `data:application/pdf;base64,${validPdfBase64}`,
          filename: 'system-architecture-spec.pdf',
          title: 'System Architecture Specification',
          description: 'Full Unraid & Docker topology specification doc',
          tags: ['architecture', 'docs']
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content_type).toBe('document');
      expect(response.body.title).toBe('System Architecture Specification');
      expect(response.body.image_path).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.pdf$/);
      expect(response.body.url).toMatch(/^\/api\/cache\/[a-f0-9]{64}\.pdf$/);
      expect(response.body.tags).toEqual(expect.arrayContaining(['architecture', 'docs', 'document', 'pdf']));

      // Verify PDF file exists and can be retrieved via /api/cache/:filename
      const cacheFilename = response.body.image_path.replace('/api/cache/', '');
      const cacheRes = await request(app).get(`/api/cache/${cacheFilename}`);
      expect(cacheRes.status).toBe(200);
      expect(cacheRes.headers['content-type']).toMatch(/application\/pdf/);
    });

    test('POST /api/bookmarks/note should create a standalone markdown memo', async () => {
      const response = await request(app)
        .post('/api/bookmarks/note')
        .set('Cookie', user1Cookie)
        .send({
          title: 'Weekly Standup Notes',
          content: '## Goals for Sprint\n- Complete PDF upload support\n- Add standalone note cards\n- Review test coverage',
          tags: ['work', 'sprint']
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.content_type).toBe('note');
      expect(response.body.title).toBe('Weekly Standup Notes');
      expect(response.body.personal_note).toContain('## Goals for Sprint');
      expect(response.body.url).toMatch(/^slip:\/\/note\//);
      expect(response.body.tags).toEqual(expect.arrayContaining(['work', 'sprint', 'note']));
    });

    test('POST /api/bookmarks should create note when contentType is note', async () => {
      const response = await request(app)
        .post('/api/bookmarks')
        .set('Cookie', user1Cookie)
        .send({
          contentType: 'note',
          title: 'Quick Idea Memo',
          content: 'Remember to check SQLite WAL checkpoint settings on high load.'
        });

      expect(response.status).toBe(201);
      expect(response.body.content_type).toBe('note');
      expect(response.body.title).toBe('Quick Idea Memo');
      expect(response.body.personal_note).toBe('Remember to check SQLite WAL checkpoint settings on high load.');
      expect(response.body.url).toMatch(/^slip:\/\/note\//);
    });
  });
});

