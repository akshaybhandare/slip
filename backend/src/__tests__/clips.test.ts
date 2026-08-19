import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';

describe('Clips Hierarchical Organization Integration Tests', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  let userCookie: string;
  let otherUserCookie: string;
  let bookmark1Id: number;
  let bookmark2Id: number;
  let hobbiesClipId: number;
  let printingClipId: number;

  test('setup test users and bookmarks', async () => {
    // User 1
    await request(app).post('/api/auth/register').send({
      username: 'clipuser',
      password: 'password123'
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      username: 'clipuser',
      password: 'password123'
    });
    userCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // User 2
    await request(app).post('/api/auth/register').set('Cookie', userCookie).send({
      username: 'otherclipuser',
      password: 'password123'
    });

    const login2Res = await request(app).post('/api/auth/login').send({
      username: 'otherclipuser',
      password: 'password123'
    });
    otherUserCookie = login2Res.headers['set-cookie'][0].split(';')[0];

    // Create 2 test bookmarks for user 1
    const b1 = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', userCookie)
      .send({
        url: 'https://prusa3d.com',
        title: 'Prusa 3D Printers Guide',
        description: 'Guide to resin and FDM 3D printing',
        tags: ['3d-printing', 'maker']
      });
    bookmark1Id = b1.body.id;

    const b2 = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', userCookie)
      .send({
        url: 'https://imdb.com/title/tt0133093',
        title: 'The Matrix',
        description: 'Must watch sci-fi movie',
        tags: ['movies', 'scifi']
      });
    bookmark2Id = b2.body.id;
  });

  test('POST /api/clips should create root clips', async () => {
    const res = await request(app)
      .post('/api/clips')
      .set('Cookie', userCookie)
      .send({ name: 'Hobbies' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Hobbies');
    expect(res.body.parent_id).toBeNull();
    hobbiesClipId = res.body.id;

    const res2 = await request(app)
      .post('/api/clips')
      .set('Cookie', userCookie)
      .send({ name: 'Movies Must Watch' });

    expect(res2.status).toBe(201);
    expect(res2.body.name).toBe('Movies Must Watch');
  });

  test('POST /api/clips should create a nested sub-clip', async () => {
    const res = await request(app)
      .post('/api/clips')
      .set('Cookie', userCookie)
      .send({
        name: '3d-printing-clip',
        parentId: hobbiesClipId
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('3d-printing-clip');
    expect(res.body.parent_id).toBe(hobbiesClipId);
    printingClipId = res.body.id;
  });

  test('GET /api/clips should return all clips with counts', async () => {
    const res = await request(app)
      .get('/api/clips')
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);

    const hobbies = res.body.find((c: any) => c.id === hobbiesClipId);
    expect(hobbies).toBeDefined();
    expect(hobbies.subclip_count).toBe(1); // 3d-printing-clip is its child
  });

  test('POST /api/clips/:id/bookmarks should add bookmark to clip', async () => {
    const res = await request(app)
      .post(`/api/clips/${printingClipId}/bookmarks`)
      .set('Cookie', userCookie)
      .send({ bookmarkId: bookmark1Id });

    expect(res.status).toBe(200);
    expect(res.body.message).toContain('success');
  });

  test('GET /api/clips/:id should return clip details, breadcrumbs, subclips, and bookmarks', async () => {
    // Create a 3rd-level nested clip
    const subSub = await request(app)
      .post('/api/clips')
      .set('Cookie', userCookie)
      .send({
        name: 'Resin Printing',
        parentId: printingClipId
      });
    const resinClipId = subSub.body.id;

    const res = await request(app)
      .get(`/api/clips/${printingClipId}`)
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);
    expect(res.body.clip.name).toBe('3d-printing-clip');
    
    // Breadcrumbs should trace Hobbies -> 3d-printing-clip
    expect(res.body.breadcrumbs.length).toBe(2);
    expect(res.body.breadcrumbs[0].name).toBe('Hobbies');
    expect(res.body.breadcrumbs[1].name).toBe('3d-printing-clip');

    // Subclips should have Resin Printing
    expect(res.body.subclips.length).toBe(1);
    expect(res.body.subclips[0].name).toBe('Resin Printing');

    // Bookmarks should include bookmark 1 with tags
    expect(res.body.bookmarks.length).toBe(1);
    expect(res.body.bookmarks[0].id).toBe(bookmark1Id);
    expect(res.body.bookmarks[0].tags.some((t: any) => t.name === '3d-printing')).toBe(true);
  });

  test('PUT /api/clips/bookmark/:bookmarkId should assign bookmark exclusively to single clip', async () => {
    // Assign bookmark1 to Hobbies
    const res = await request(app)
      .put(`/api/clips/bookmark/${bookmark1Id}`)
      .set('Cookie', userCookie)
      .send({ clipId: hobbiesClipId });

    expect(res.status).toBe(200);
    expect(res.body.clip.id).toBe(hobbiesClipId);
    expect(res.body.clips.length).toBe(1);

    // Re-assigning bookmark1 to printingClipId automatically moves it out of hobbiesClipId
    const moveRes = await request(app)
      .put(`/api/clips/bookmark/${bookmark1Id}`)
      .set('Cookie', userCookie)
      .send({ clipId: printingClipId });

    expect(moveRes.status).toBe(200);
    expect(moveRes.body.clip.id).toBe(printingClipId);
    expect(moveRes.body.clips.length).toBe(1);

    const getClips = await request(app)
      .get(`/api/clips/bookmark/${bookmark1Id}`)
      .set('Cookie', userCookie);

    expect(getClips.status).toBe(200);
    expect(getClips.body.length).toBe(1);
    expect(getClips.body[0].id).toBe(printingClipId);
  });

  test('PUT /api/clips/:id should update clip name', async () => {
    const res = await request(app)
      .put(`/api/clips/${printingClipId}`)
      .set('Cookie', userCookie)
      .send({ name: '3D Printing & CAD' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('3D Printing & CAD');
  });

  test('PUT /api/clips/:id should prevent circular nesting', async () => {
    // Attempt to make Hobbies a child of printingClipId (which is already a child of Hobbies)
    const res = await request(app)
      .put(`/api/clips/${hobbiesClipId}`)
      .set('Cookie', userCookie)
      .send({ parentId: printingClipId });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('circular');
  });

  test('PUT /api/clips/:id should prevent clip being its own parent', async () => {
    const res = await request(app)
      .put(`/api/clips/${hobbiesClipId}`)
      .set('Cookie', userCookie)
      .send({ parentId: hobbiesClipId });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('own parent');
  });

  test('DELETE /api/clips/:id/bookmarks/:bookmarkId should remove bookmark from clip', async () => {
    const res = await request(app)
      .delete(`/api/clips/${printingClipId}/bookmarks/${bookmark1Id}`)
      .set('Cookie', userCookie);

    expect(res.status).toBe(200);

    const check = await request(app)
      .get(`/api/clips/${printingClipId}`)
      .set('Cookie', userCookie);

    expect(check.body.bookmarks.length).toBe(0);
  });

  test('DELETE /api/clips/:id should delete clip and cascade subclips while leaving bookmarks intact', async () => {
    const deleteRes = await request(app)
      .delete(`/api/clips/${hobbiesClipId}`)
      .set('Cookie', userCookie);

    expect(deleteRes.status).toBe(200);

    // Hobbies and its subclips should be gone
    const checkClips = await request(app)
      .get('/api/clips')
      .set('Cookie', userCookie);

    expect(checkClips.body.some((c: any) => c.id === hobbiesClipId)).toBe(false);
    expect(checkClips.body.some((c: any) => c.id === printingClipId)).toBe(false);

    // The bookmark itself must still exist in main bookmarks!
    const checkBookmark = await request(app)
      .get('/api/bookmarks')
      .set('Cookie', userCookie);

    expect(checkBookmark.body.some((b: any) => b.id === bookmark1Id)).toBe(true);
  });

  test('Security: user cannot access other user clips', async () => {
    const otherClip = await request(app)
      .post('/api/clips')
      .set('Cookie', otherUserCookie)
      .send({ name: 'Private Other User Clip' });

    const otherClipId = otherClip.body.id;

    // User 1 tries to access user 2 clip
    const getRes = await request(app)
      .get(`/api/clips/${otherClipId}`)
      .set('Cookie', userCookie);
    expect(getRes.status).toBe(404);

    // User 1 tries to delete user 2 clip
    const delRes = await request(app)
      .delete(`/api/clips/${otherClipId}`)
      .set('Cookie', userCookie);
    expect(delRes.status).toBe(404);
  });
});
