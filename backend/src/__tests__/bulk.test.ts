import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';
import {
  isActionSupported,
  getSupportedActions,
  getSupportedBulkActions,
  ACTION_DEFINITIONS
} from '../services/actionRegistry';

describe('Bulk Operations & Action Registry Single Source of Truth', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  let user1Cookie: string;
  let user2Cookie: string;

  describe('Action Registry & Capability Matrix Unit Rules', () => {
    test('Action Registry defines valid capabilities for all slip types and contexts', () => {
      // 1. Note: supports reader, share, edit, pin, organize, note auto-tag, delete; NOT rescrape or external link
      expect(isActionSupported('open_reader', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(true);
      expect(isActionSupported('open_link', { itemType: 'slip', contentType: 'note', url: 'slip://note/1', context: 'feed' })).toBe(false);
      expect(isActionSupported('rescrape', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(false);
      expect(isActionSupported('delete', { itemType: 'slip', contentType: 'note', context: 'feed' })).toBe(true);

      // 2. Document (PDF): supports open_link, share, edit, pin, organize, delete; NOT rescrape, open_reader
      expect(isActionSupported('open_link', { itemType: 'slip', contentType: 'document', url: 'https://example.com/doc.pdf', context: 'feed' })).toBe(true);
      expect(isActionSupported('open_reader', { itemType: 'slip', contentType: 'document', context: 'feed' })).toBe(false);
      expect(isActionSupported('rescrape', { itemType: 'slip', contentType: 'document', context: 'feed' })).toBe(false);
      expect(isActionSupported('delete', { itemType: 'slip', contentType: 'document', context: 'feed' })).toBe(true);

      // 3. Website / Article: supports rescrape, auto_tag, open_link, delete
      expect(isActionSupported('rescrape', { itemType: 'slip', contentType: 'website', url: 'https://example.com', context: 'feed' })).toBe(true);
      expect(isActionSupported('auto_tag', { itemType: 'slip', contentType: 'website', url: 'https://example.com', isAIConnected: true, context: 'feed' })).toBe(true);
      expect(isActionSupported('auto_tag', { itemType: 'slip', contentType: 'website', url: 'https://example.com', isAIConnected: false, context: 'feed' })).toBe(false);

      // 4. Recycle Clip context: only supports restore & permanent_delete
      expect(isActionSupported('delete', { itemType: 'slip', contentType: 'website', context: 'recycle_clip' })).toBe(false);
      expect(isActionSupported('restore', { itemType: 'slip', contentType: 'website', context: 'recycle_clip' })).toBe(true);
      expect(isActionSupported('permanent_delete', { itemType: 'slip', contentType: 'website', context: 'recycle_clip' })).toBe(true);
      expect(isActionSupported('open_link', { itemType: 'slip', contentType: 'website', context: 'recycle_clip' })).toBe(false);

      // 5. Clips: supports delete in feed, restore/permanent_delete in recycle
      expect(isActionSupported('delete', { itemType: 'clip', context: 'feed' })).toBe(true);
      expect(isActionSupported('restore', { itemType: 'clip', context: 'recycle_clip' })).toBe(true);
      expect(isActionSupported('permanent_delete', { itemType: 'clip', context: 'recycle_clip' })).toBe(true);
    });

    test('getSupportedBulkActions returns appropriate bulk actions for selection and context', () => {
      // In feed / active clip
      const feedBulk = getSupportedBulkActions({ slipCount: 3, clipCount: 1, context: 'feed' });
      expect(feedBulk.map((a) => a.id)).toEqual(['delete']);

      // In clip detail with only slips
      const clipDetailBulk = getSupportedBulkActions({ slipCount: 2, clipCount: 0, context: 'clip_detail' });
      expect(clipDetailBulk.map((a) => a.id)).toEqual(['delete', 'remove_from_clip']);

      // In recycle clip
      const recycleBulk = getSupportedBulkActions({ slipCount: 2, clipCount: 1, context: 'recycle_clip' });
      expect(recycleBulk.map((a) => a.id)).toEqual(['restore', 'permanent_delete']);

      // Empty selection
      const emptyBulk = getSupportedBulkActions({ slipCount: 0, clipCount: 0, context: 'feed' });
      expect(emptyBulk).toEqual([]);
    });
  });

  describe('Integration Endpoints for Bulk Operations', () => {
    test('setup test users', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'bulkuser1',
        password: 'password123'
      });

      const login1 = await request(app).post('/api/auth/login').send({
        username: 'bulkuser1',
        password: 'password123'
      });
      user1Cookie = login1.headers['set-cookie'][0].split(';')[0];

      await request(app).post('/api/auth/register').set('Cookie', user1Cookie).send({
        username: 'bulkuser2',
        password: 'password123'
      });

      const login2 = await request(app).post('/api/auth/login').send({
        username: 'bulkuser2',
        password: 'password123'
      });
      user2Cookie = login2.headers['set-cookie'][0].split(';')[0];
    });

    test('POST /api/bookmarks/bulk/delete should soft delete multiple bookmarks and unpin them', async () => {
      // Create 3 bookmarks
      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/b1',
        title: 'Bulk Item 1',
        contentType: 'website'
      });
      const b2 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/b2',
        title: 'Bulk Item 2',
        contentType: 'article'
      });
      const b3 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/b3',
        title: 'Bulk Item 3',
        contentType: 'note'
      });

      // Pin b1
      await request(app).put(`/api/bookmarks/${b1.body.id}/pin`).set('Cookie', user1Cookie).send({ pinned: true });

      // Bulk soft delete b1 and b2
      const delRes = await request(app)
        .post('/api/bookmarks/bulk/delete')
        .set('Cookie', user1Cookie)
        .send({ ids: [b1.body.id, b2.body.id] });

      expect(delRes.status).toBe(200);
      expect(delRes.body.deletedCount).toBe(2);

      // Verify b1 and b2 are in recycle clip and not in active bookmarks
      const active = await request(app).get('/api/bookmarks').set('Cookie', user1Cookie);
      const activeIds = active.body.map((b: any) => b.id);
      expect(activeIds).not.toContain(b1.body.id);
      expect(activeIds).not.toContain(b2.body.id);
      expect(activeIds).toContain(b3.body.id);

      const recycle = await request(app).get('/api/bookmarks/recycle-clip').set('Cookie', user1Cookie);
      const recycleIds = recycle.body.map((b: any) => b.id);
      expect(recycleIds).toContain(b1.body.id);
      expect(recycleIds).toContain(b2.body.id);

      // Verify unpinned
      const b1InRecycle = recycle.body.find((b: any) => b.id === b1.body.id);
      expect(b1InRecycle.is_pinned).toBeFalsy();
    });

    test('POST /api/bookmarks/bulk/restore should restore multiple bookmarks', async () => {
      // Create and delete 2 bookmarks
      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/restore1',
        title: 'Restore Item 1'
      });
      const b2 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/restore2',
        title: 'Restore Item 2'
      });

      await request(app).post('/api/bookmarks/bulk/delete').set('Cookie', user1Cookie).send({ ids: [b1.body.id, b2.body.id] });

      // Bulk restore
      const resRes = await request(app)
        .post('/api/bookmarks/bulk/restore')
        .set('Cookie', user1Cookie)
        .send({ ids: [b1.body.id, b2.body.id] });

      expect(resRes.status).toBe(200);
      expect(resRes.body.restoredCount).toBe(2);

      const active = await request(app).get('/api/bookmarks').set('Cookie', user1Cookie);
      const activeIds = active.body.map((b: any) => b.id);
      expect(activeIds).toContain(b1.body.id);
      expect(activeIds).toContain(b2.body.id);
    });

    test('POST /api/bookmarks/bulk/permanent should permanently eradicate multiple bookmarks', async () => {
      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/perm1',
        title: 'Perm Item 1'
      });
      const b2 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({
        url: 'https://example.com/perm2',
        title: 'Perm Item 2'
      });

      // Must be trashed first
      await request(app).post('/api/bookmarks/bulk/delete').set('Cookie', user1Cookie).send({ ids: [b1.body.id, b2.body.id] });

      const permRes = await request(app)
        .post('/api/bookmarks/bulk/permanent')
        .set('Cookie', user1Cookie)
        .send({ ids: [b1.body.id, b2.body.id] });

      expect(permRes.status).toBe(200);
      expect(permRes.body.deletedCount).toBe(2);

      const recycle = await request(app).get('/api/bookmarks/recycle-clip').set('Cookie', user1Cookie);
      const recycleIds = recycle.body.map((b: any) => b.id);
      expect(recycleIds).not.toContain(b1.body.id);
      expect(recycleIds).not.toContain(b2.body.id);
    });

    test('POST /api/clips/bulk/delete should cascade soft delete multiple clips and member slips', async () => {
      // Create clip 1 with subclip and slip
      const c1 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Bulk Clip 1' });
      const c1Child = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Bulk Clip 1 Child', parentId: c1.body.id });
      const c2 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Bulk Clip 2' });

      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({ url: 'https://example.com/c1slip', title: 'C1 Slip' });
      await request(app).post(`/api/clips/${c1Child.body.id}/bookmarks`).set('Cookie', user1Cookie).send({ bookmarkId: b1.body.id });

      const b2 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({ url: 'https://example.com/c2slip', title: 'C2 Slip' });
      await request(app).post(`/api/clips/${c2.body.id}/bookmarks`).set('Cookie', user1Cookie).send({ bookmarkId: b2.body.id });

      // Bulk delete c1 and c2 with include_children=true
      const delRes = await request(app)
        .post('/api/clips/bulk/delete')
        .set('Cookie', user1Cookie)
        .send({ ids: [c1.body.id, c2.body.id], include_children: true });

      expect(delRes.status).toBe(200);
      expect(delRes.body.deletedCount).toBeGreaterThanOrEqual(3); // c1, c1Child, c2

      // Verify clips in recycle
      const trashedClips = await request(app).get('/api/clips/recycle-clip').set('Cookie', user1Cookie);
      const trashedClipIds = trashedClips.body.map((c: any) => c.id);
      expect(trashedClipIds).toContain(c1.body.id);
      expect(trashedClipIds).toContain(c1Child.body.id);
      expect(trashedClipIds).toContain(c2.body.id);

      // Verify slips in recycle
      const trashedSlips = await request(app).get('/api/bookmarks/recycle-clip').set('Cookie', user1Cookie);
      const trashedSlipIds = trashedSlips.body.map((b: any) => b.id);
      expect(trashedSlipIds).toContain(b1.body.id);
      expect(trashedSlipIds).toContain(b2.body.id);
    });

    test('POST /api/clips/bulk/restore should restore multiple clips and member slips', async () => {
      // Create and delete 2 clips
      const c1 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Restore Clip 1' });
      const c2 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Restore Clip 2' });
      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({ url: 'https://example.com/rclipbm', title: 'RClip BM' });
      await request(app).post(`/api/clips/${c1.body.id}/bookmarks`).set('Cookie', user1Cookie).send({ bookmarkId: b1.body.id });

      await request(app).post('/api/clips/bulk/delete').set('Cookie', user1Cookie).send({ ids: [c1.body.id, c2.body.id] });

      // Bulk restore
      const restoreRes = await request(app)
        .post('/api/clips/bulk/restore')
        .set('Cookie', user1Cookie)
        .send({ ids: [c1.body.id, c2.body.id] });

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.restoredCount).toBe(2);

      const activeClips = await request(app).get('/api/clips').set('Cookie', user1Cookie);
      const activeClipIds = activeClips.body.map((c: any) => c.id);
      expect(activeClipIds).toContain(c1.body.id);
      expect(activeClipIds).toContain(c2.body.id);

      const activeBookmarks = await request(app).get('/api/bookmarks').set('Cookie', user1Cookie);
      const activeBookmarkIds = activeBookmarks.body.map((b: any) => b.id);
      expect(activeBookmarkIds).toContain(b1.body.id);
    });

    test('POST /api/clips/bulk/permanent should permanently delete multiple clips', async () => {
      const c1 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Perm Clip 1' });
      const c2 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Perm Clip 2' });

      await request(app).post('/api/clips/bulk/delete').set('Cookie', user1Cookie).send({ ids: [c1.body.id, c2.body.id] });

      const permRes = await request(app)
        .post('/api/clips/bulk/permanent')
        .set('Cookie', user1Cookie)
        .send({ ids: [c1.body.id, c2.body.id] });

      expect(permRes.status).toBe(200);
      expect(permRes.body.deletedCount).toBe(2);

      const trashed = await request(app).get('/api/clips/recycle-clip').set('Cookie', user1Cookie);
      const trashedIds = trashed.body.map((c: any) => c.id);
      expect(trashedIds).not.toContain(c1.body.id);
      expect(trashedIds).not.toContain(c2.body.id);
    });

    test('POST /api/bulk/delete, /restore, and /permanent should handle mixed slips and clips seamlessly', async () => {
      const b1 = await request(app).post('/api/bookmarks').set('Cookie', user1Cookie).send({ url: 'https://example.com/mixed1', title: 'Mixed Slip 1' });
      const c1 = await request(app).post('/api/clips').set('Cookie', user1Cookie).send({ name: 'Mixed Clip 1' });

      // Unified Bulk Delete
      const delRes = await request(app)
        .post('/api/bulk/delete')
        .set('Cookie', user1Cookie)
        .send({ slipIds: [b1.body.id], clipIds: [c1.body.id] });

      expect(delRes.status).toBe(200);
      expect(delRes.body.deletedSlipsCount).toBe(1);
      expect(delRes.body.deletedClipsCount).toBe(1);

      // Unified Bulk Restore
      const resRes = await request(app)
        .post('/api/bulk/restore')
        .set('Cookie', user1Cookie)
        .send({ slipIds: [b1.body.id], clipIds: [c1.body.id] });

      expect(resRes.status).toBe(200);
      expect(resRes.body.restoredSlipsCount).toBe(1);
      expect(resRes.body.restoredClipsCount).toBe(1);

      // Delete again and Bulk Permanent Delete
      await request(app).post('/api/bulk/delete').set('Cookie', user1Cookie).send({ slipIds: [b1.body.id], clipIds: [c1.body.id] });

      const permRes = await request(app)
        .post('/api/bulk/permanent')
        .set('Cookie', user1Cookie)
        .send({ slipIds: [b1.body.id], clipIds: [c1.body.id] });

      expect(permRes.status).toBe(200);
      expect(permRes.body.deletedSlipsCount).toBe(1);
      expect(permRes.body.deletedClipsCount).toBe(1);
    });

    test('Security: user cannot bulk delete or restore other users slips or clips', async () => {
      const user2Slip = await request(app).post('/api/bookmarks').set('Cookie', user2Cookie).send({ url: 'https://example.com/u2slip', title: 'U2 Slip' });
      const user2Clip = await request(app).post('/api/clips').set('Cookie', user2Cookie).send({ name: 'U2 Clip' });

      // User 1 attempts to bulk delete User 2's items
      const hackDel = await request(app)
        .post('/api/bulk/delete')
        .set('Cookie', user1Cookie)
        .send({ slipIds: [user2Slip.body.id], clipIds: [user2Clip.body.id] });

      expect(hackDel.status).toBe(200);
      expect(hackDel.body.deletedSlipsCount).toBe(0);
      expect(hackDel.body.deletedClipsCount).toBe(0);

      // Ensure user2 items remain active
      const u2Active = await request(app).get('/api/bookmarks').set('Cookie', user2Cookie);
      expect(u2Active.body.map((b: any) => b.id)).toContain(user2Slip.body.id);
    });
  });
});
