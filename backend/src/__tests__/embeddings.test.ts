import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';
import {
  generateEmbedding,
  computeCosineSimilarity,
  buildSlipText,
  saveBookmarkEmbedding,
  getBookmarkEmbedding,
  getAllUserEmbeddings,
  indexBookmark,
  findRelatedBookmarks,
  suggestTagsForBookmark,
  getEmbeddingStatus,
  reindexAllUserBookmarks
} from '../services/embeddingService';

describe('On-Device Semantic Embeddings & Related Slips (Issues #37 & #40)', () => {
  let db: any;
  let authCookie: string;
  let userId: number;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    db = initDb(':memory:');

    // Register test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'vectortester', password: 'password123' });

    userId = regRes.body.userId;
    const cookies = regRes.headers['set-cookie'];
    authCookie = Array.isArray(cookies) ? cookies[0] : cookies;
  }, 30000);

  afterAll(() => {
    closeDb();
  });

  describe('1. Vector Math & Embedding Pipeline', () => {
    it('generates a 384-dimensional normalized vector for text', async () => {
      const vec = await generateEmbedding('TypeScript and Node.js development tutorial');
      expect(vec).not.toBeNull();
      expect(vec!.length).toBe(384);

      // Verify L2 normalization: norm should be ~1.0
      let norm = 0;
      for (let i = 0; i < vec!.length; i++) {
        norm += vec![i] * vec![i];
      }
      expect(Math.sqrt(norm)).toBeCloseTo(1.0, 2);
    }, 20000);

    it('computes accurate cosine similarity (dot product)', async () => {
      const vecA = await generateEmbedding('Star Wars galactic empire movie', true);
      const vecB = await generateEmbedding('Sci-fi space battle cinema', false);
      const vecC = await generateEmbedding('How to bake sourdough bread recipe', false);

      expect(vecA).not.toBeNull();
      expect(vecB).not.toBeNull();
      expect(vecC).not.toBeNull();

      const simSimilar = computeCosineSimilarity(vecA!, vecB!);
      const simUnrelated = computeCosineSimilarity(vecA!, vecC!);

      // Semantically related texts should have significantly higher similarity
      expect(simSimilar).toBeGreaterThan(simUnrelated);
      expect(simSimilar).toBeGreaterThan(0.4);
    });

    it('builds clean representative text from bookmark fields', () => {
      const text = buildSlipText({
        title: 'React 19 Documentation',
        description: 'Latest React features and Server Components guide',
        personal_note: 'Important for frontend refactor',
        tags: [{ name: 'react' }, { name: 'frontend' }],
        raw_text: 'Full text excerpt of React 19 changes'
      });

      expect(text).toContain('React 19 Documentation');
      expect(text).toContain('Server Components guide');
      expect(text).toContain('Note: Important for frontend refactor');
      expect(text).toContain('Tags: react, frontend');
    });
  });

  describe('2. SQLite Vector Storage & Indexing', () => {
    let testBookmarkId: number;

    beforeAll(() => {
      const res = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, 'https://docker.com', 'Docker Container Guide', 'Containerization tutorial', 'website')
      `).run(userId);
      testBookmarkId = Number(res.lastInsertRowid);
    });

    it('saves and retrieves Float32Array embedding from SQLite BLOB', () => {
      const mockVector = new Float32Array(384);
      for (let i = 0; i < 384; i++) {
        mockVector[i] = i / 384;
      }

      saveBookmarkEmbedding(db, testBookmarkId, mockVector, 'test-model');
      const retrieved = getBookmarkEmbedding(db, testBookmarkId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.length).toBe(384);
      expect(retrieved![0]).toBeCloseTo(mockVector[0]);
      expect(retrieved![100]).toBeCloseTo(mockVector[100]);
    });

    it('indexes a bookmark and persists its embedding', async () => {
      const success = await indexBookmark(testBookmarkId);
      expect(success).toBe(true);

      const emb = getBookmarkEmbedding(db, testBookmarkId);
      expect(emb).not.toBeNull();
      expect(emb!.length).toBe(384);
    });

    it('cascades embedding deletion when bookmark is deleted', () => {
      const tempBm = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title) VALUES (?, 'https://temp.org', 'Temp')
      `).run(userId);
      const tempId = Number(tempBm.lastInsertRowid);

      saveBookmarkEmbedding(db, tempId, new Float32Array(384));
      expect(getBookmarkEmbedding(db, tempId)).not.toBeNull();

      // Delete bookmark
      db.prepare(`DELETE FROM bookmarks WHERE id = ?`).run(tempId);
      expect(getBookmarkEmbedding(db, tempId)).toBeNull();
    });
  });

  describe('3. Hybrid Search & Semantic Matching Endpoints', () => {
    let bm1Id: number;
    let bm2Id: number;
    let bm3Id: number;

    beforeAll(async () => {
      // Create bookmarks with distinct themes
      const r1 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, 'https://vuejs.org', 'Vue 3 Framework Guide', 'Progressive JavaScript framework for building user interfaces', 'website')
      `).run(userId);
      bm1Id = Number(r1.lastInsertRowid);

      const r2 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, 'https://react.dev', 'React Library Manual', 'Component based UI library for web and native', 'website')
      `).run(userId);
      bm2Id = Number(r2.lastInsertRowid);

      const r3 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, 'https://pizza.com', 'Authentic Neapolitan Pizza Recipe', 'Homemade dough and wood fired baking instructions', 'website')
      `).run(userId);
      bm3Id = Number(r3.lastInsertRowid);

      // Index them
      await indexBookmark(bm1Id);
      await indexBookmark(bm2Id);
      await indexBookmark(bm3Id);
    });

    it('GET /api/bookmarks/search performs hybrid search combining lexical and semantic results', async () => {
      const res = await request(app)
        .get('/api/bookmarks/search?q=frontend+framework+interface')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      // Vue or React should rank at the top
      const ids = res.body.map((b: any) => b.id);
      expect(ids).toContain(bm1Id);
      expect(ids).toContain(bm2Id);
      expect(ids.indexOf(bm3Id)).toBe(-1); // Pizza should not match frontend UI
    });
  });

  describe('4. Related Slips Recommendations (Issue #40)', () => {
    let reactSlipId: number;
    let vueSlipId: number;
    let angularSlipId: number;
    let cookingSlipId: number;

    beforeAll(async () => {
      const r1 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://react.dev/blog', 'React Server Actions Guide', 'How to mutate data with server actions and forms in React 19')
      `).run(userId);
      reactSlipId = Number(r1.lastInsertRowid);

      const r2 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://react.dev/reference/react', 'React Components and Hooks API', 'Comprehensive reference for React 19 component hooks and server actions')
      `).run(userId);
      vueSlipId = Number(r2.lastInsertRowid);

      const r3 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://angular.dev', 'Angular Signals State Management', 'Reactive primitives for UI components in modern Angular')
      `).run(userId);
      angularSlipId = Number(r3.lastInsertRowid);

      const r4 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://seriouseats.com/soup', 'Classic French Onion Soup', 'Caramelized onions beef broth melted gruyere croutons')
      `).run(userId);
      cookingSlipId = Number(r4.lastInsertRowid);

      await indexBookmark(reactSlipId);
      await indexBookmark(vueSlipId);
      await indexBookmark(angularSlipId);
      await indexBookmark(cookingSlipId);
    });

    it('finds top semantically related slips with >= 70% confidence excluding self', async () => {
      const related = await findRelatedBookmarks(reactSlipId, userId, 3);
      expect(related.length).toBeGreaterThanOrEqual(1);

      const relatedIds = related.map((r) => r.bookmark.id);
      expect(relatedIds).not.toContain(reactSlipId); // Never includes self
      expect(relatedIds).toContain(vueSlipId); // Strongly related React slip
      expect(relatedIds).not.toContain(cookingSlipId); // Soup should not be related to React
      expect(related[0].similarityScore).toBeGreaterThanOrEqual(70);
    });

    it('GET /api/bookmarks/:id/related returns related slips with similarity score', async () => {
      const res = await request(app)
        .get(`/api/bookmarks/${reactSlipId}/related?limit=3`)
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('similarityScore');
        expect(res.body[0].similarityScore).toBeGreaterThan(0);
      }
    });
  });

  describe('5. Offline Tag Centroid Suggestions (Issue #40)', () => {
    let devSlipId: number;
    let cookingSlipId: number;
    let tagDevId: number;
    let tagCookingId: number;

    beforeAll(async () => {
      // Create tags
      const t1 = db.prepare(`INSERT INTO tags (name) VALUES ('programming') RETURNING id`).get() as { id: number };
      tagDevId = t1.id;
      const t2 = db.prepare(`INSERT INTO tags (name) VALUES ('culinary') RETURNING id`).get() as { id: number };
      tagCookingId = t2.id;

      // Link tags to bookmarks
      const b1 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://rust-lang.org', 'Rust Systems Programming', 'Memory safety concurrency and cargo package manager')
      `).run(userId);
      devSlipId = Number(b1.lastInsertRowid);
      db.prepare(`INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`).run(devSlipId, tagDevId);
      await indexBookmark(devSlipId);

      const b2 = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description)
        VALUES (?, 'https://food52.com/pasta', 'Handmade Fresh Fettuccine Pasta', 'Flour eggs semolina rolling pin pasta dough recipe')
      `).run(userId);
      cookingSlipId = Number(b2.lastInsertRowid);
      db.prepare(`INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`).run(cookingSlipId, tagCookingId);
      await indexBookmark(cookingSlipId);
    });

    it('suggests tags based on centroid vector similarity', async () => {
      const suggestions = await suggestTagsForBookmark(
        {
          title: 'Go Golang Concurrency with Goroutines and Channels',
          description: 'Writing high throughput backend microservices'
        },
        userId
      );

      expect(Array.isArray(suggestions)).toBe(true);
      const tagNames = suggestions.map((s) => s.name);
      expect(tagNames).toContain('programming');
      expect(tagNames).not.toContain('culinary');
    });

    it('POST /api/embeddings/suggest-tags returns offline suggestions', async () => {
      const res = await request(app)
        .post('/api/embeddings/suggest-tags')
        .set('Cookie', authCookie)
        .send({
          title: 'Italian Gnocchi and Marinara Sauce',
          description: 'Boiled potato dumplings with basil and parmesan'
        });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const names = res.body.map((s: any) => s.name);
      expect(names).toContain('culinary');
    });
  });

  describe('6. Embeddings Status & Library Re-indexing', () => {
    it('GET /api/embeddings/status returns accurate library embedding metrics', async () => {
      const res = await request(app)
        .get('/api/embeddings/status')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalBookmarks');
      expect(res.body).toHaveProperty('indexedBookmarks');
      expect(res.body).toHaveProperty('percentage');
      expect(res.body).toHaveProperty('modelName');
      expect(res.body.percentage).toBeGreaterThan(0);
    });

    it('POST /api/embeddings/reindex re-indexes all user slips', async () => {
      const res = await request(app)
        .post('/api/embeddings/reindex')
        .set('Cookie', authCookie);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('indexed');
      expect(res.body.indexed).toBeGreaterThanOrEqual(1);
    });
  });
});
