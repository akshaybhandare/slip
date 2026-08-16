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
});
