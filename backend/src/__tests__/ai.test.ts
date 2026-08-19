import request from 'supertest';
import axios from 'axios';
import app from '../server';
import { initDb, closeDb, getDb } from '../db';
import { encryptSecret, decryptSecret, maskApiKey } from '../services/aiCrypto';
import * as aiService from '../services/aiService';

describe('AI Backend Encryption, Authorization & Database Persistence', () => {
  let adminToken: string;
  let regularToken: string;

  beforeAll(async () => {
    initDb(':memory:');

    // Register admin (first user -> id 1)
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'adminuser', password: 'Password123!' });
    adminToken = adminRes.body.token;

    // Register regular user (id 2) via admin token
    const userRes = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'regularuser', password: 'Password123!' });
    
    // Login regular user to get token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'regularuser', password: 'Password123!' });
    regularToken = loginRes.body.token;
  });

  afterAll(() => {
    closeDb();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Crypto & Key Masking Utilities', () => {
    it('encrypts and decrypts secrets with AES-256-GCM', () => {
      const key = 'sk-proj-test-secret-key-1234567890';
      const encrypted = encryptSecret(key);
      expect(encrypted).not.toBe(key);
      expect(encrypted).toContain(':');

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(key);
    });

    it('masks API keys securely showing trailing 4 characters', () => {
      expect(maskApiKey('sk-proj-1234567890abcdef1234a82f')).toBe('••••••••••••••••••••••a82f');
      expect(maskApiKey('abcd')).toBe('••••••••••••••••••••••abcd');
    });
  });

  describe('AI Endpoints Security and Persistence', () => {
    it('returns isConnected: false when no AI config exists in DB', async () => {
      const res = await request(app)
        .get('/api/ai/config')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isConnected).toBe(false);
      expect(res.body.isAdmin).toBe(false);
    });

    it('rejects AI configuration from non-admin users with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          provider: 'openai',
          apiKey: 'sk-test-key-1234'
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Only administrators/i);
    });

    it('rejects saving when connection test fails', async () => {
      jest.spyOn(aiService, 'testProviderConnection').mockResolvedValueOnce({
        success: false,
        message: 'Invalid API key provided (401 Unauthorized)'
      });

      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'openai',
          apiKey: 'invalid-key'
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Connection test failed/i);

      // Verify nothing was stored in settings
      const db = getDb();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config');
      expect(row).toBeUndefined();
    });

    it('tests and saves AI configuration in SQLite when connection test passes', async () => {
      jest.spyOn(aiService, 'testProviderConnection').mockResolvedValueOnce({
        success: true,
        message: 'Connected to OpenAI model "gpt-4o-mini" successfully (120ms).'
      });

      const res = await request(app)
        .post('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          provider: 'openai',
          model: 'gpt-4o-mini',
          apiKey: 'sk-proj-valid-secret-key-1234a82f'
        });

      expect(res.status).toBe(200);
      expect(res.body.config.isConnected).toBe(true);
      expect(res.body.config.provider).toBe('openai');
      expect(res.body.config.model).toBe('gpt-4o-mini');
      expect(res.body.config.maskedApiKey).toBe('••••••••••••••••••••••a82f');

      // Verify stored encrypted in DB
      const db = getDb();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config') as { value: string };
      expect(row).toBeDefined();
      const parsed = JSON.parse(row.value);
      expect(parsed.is_connected).toBe(true);
      expect(parsed.provider).toBe('openai');
      expect(parsed.model).toBe('gpt-4o-mini');
      expect(parsed.encrypted_api_key).not.toBe('sk-proj-valid-secret-key-1234a82f');
      expect(decryptSecret(parsed.encrypted_api_key)).toBe('sk-proj-valid-secret-key-1234a82f');
    });

    it('allows non-admin to view read-only masked configuration without exposing secret', async () => {
      const res = await request(app)
        .get('/api/ai/config')
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.isConnected).toBe(true);
      expect(res.body.provider).toBe('openai');
      expect(res.body.model).toBe('gpt-4o-mini');
      expect(res.body.maskedApiKey).toBe('••••••••••••••••••••••a82f');
      expect(res.body.isAdmin).toBe(false);
      expect(res.body.apiKey).toBeUndefined();
    });

    it('allows admin to disconnect AI config, purging it from DB', async () => {
      const res = await request(app)
        .delete('/api/ai/config')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.config.isConnected).toBe(false);

      const db = getDb();
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config');
      expect(row).toBeUndefined();
    });
  });

  describe('AI Content Auto-Tagging Engine & Endpoints', () => {
    it('contains the expected system prompt rules and formatting instructions', () => {
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('You are an automatic content tagger.');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('Prefer existing tags whenever they accurately describe the content.');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('NEVER create a new tag if an existing tag has the same or substantially similar meaning.');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('bambulab');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('3d-printing');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('"tags": ["existing-tag-1", "existing-tag-2"]');
      expect(aiService.AUTO_TAG_SYSTEM_PROMPT).toContain('"newTags": ["genuinely-new-tag"]');
    });

    it('parses and sanitizes JSON tag responses and cleans markdown fences', () => {
      const rawJson = '```json\n{\n  "tags": ["react", "frontend"],\n  "newTags": ["NextJS 15", "#state-management", "UI/UX DESIGN"]\n}\n```';
      const result = aiService.parseAndSanitizeTags(rawJson);

      expect(result.tags).toEqual(['react', 'frontend']);
      expect(result.newTags).toEqual(['nextjs-15', 'state-management', 'uiux-design']);
    });

    it('normalizes tags consistently and handles spaces, casing, and hashes', () => {
      expect(aiService.normalizeTag('  #3D_Printing  ')).toBe('3d-printing');
      expect(aiService.normalizeTag('Bambu Lab')).toBe('bambu-lab');
      expect(aiService.normalizeTag('JavaScript')).toBe('javascript');
      expect(aiService.normalizeTag('react.js')).toBe('reactjs');
    });

    it('validates and maps LLM output against existingTags via processTags', () => {
      const existingTags = ['3d-printing', 'bambulab', 'javascript'];

      // Scenario 1: LLM proposes existing tags (even with slightly different casing) and new tags
      const result1 = aiService.processTags(
        {
          tags: ['3D-Printing', 'bambulab', 'non-existent-hallucinated-tag'],
          newTags: ['cura-slicer', 'filament']
        },
        existingTags
      );

      // Should map to canonical existing tags, discard hallucinated existing tag, and enforce max 3 tags
      expect(result1).toContain('3d-printing');
      expect(result1).toContain('bambulab');
      expect(result1).not.toContain('non-existent-hallucinated-tag');
      expect(result1.length).toBe(3);

      // Scenario 2: LLM accidentally puts an existing tag into newTags
      const result2 = aiService.processTags(
        {
          tags: [],
          newTags: ['JavaScript', 'web-development']
        },
        existingTags
      );

      // Should reuse existing tag 'javascript' without creating a duplicate
      expect(result2).toContain('javascript');
      expect(result2).toContain('web-development');
      expect(result2.length).toBe(2);
    });

    it('strictly limits returned tags to at most 3 tags', () => {
      const existingTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];
      const result = aiService.processTags(
        {
          tags: ['tag1', 'tag2', 'tag3', 'tag4'],
          newTags: ['new1', 'new2', 'new3']
        },
        existingTags
      );
      expect(result.length).toBe(3);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('generates auto-tags using active AI config with mocked LLM response', async () => {
      // Connect OpenAI config in DB
      const db = getDb();
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
        'ai_config',
        JSON.stringify({
          provider: 'openai',
          encrypted_api_key: encryptSecret('sk-test-ai-key-1234'),
          masked_api_key: '••••••••1234',
          api_url: 'https://api.openai.com/v1',
          is_connected: true,
          last_tested_at: new Date().toISOString()
        })
      );

      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tags: ['bambulab'],
                  newTags: ['3d-printing', 'diy']
                })
              }
            }
          ]
        }
      } as any);

      const tagsResult = await aiService.generateAutoTags({
        content: 'Bambu Lab X1 Carbon 3D printer calibration guide',
        existingTags: ['bambulab', 'technology']
      });

      expect(tagsResult.tags).toEqual(['bambulab']);
      expect(tagsResult.newTags).toEqual(['3d-printing', 'diy']);
    });

    it('auto-tags an untagged bookmark via autoTagBookmark service', async () => {
      const db = getDb();
      // Insert an untagged bookmark for regularUser (id: 2)
      const insertBm = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type, raw_text)
        VALUES (?, ?, ?, ?, 'website', ?)
      `).run(2, 'https://react.dev', 'React Documentation', 'The library for web and native user interfaces', 'React lets you build user interfaces out of individual pieces called components.');
      const bookmarkId = insertBm.lastInsertRowid;

      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tags: [],
                  newTags: ['react', 'javascript', 'frontend']
                })
              }
            }
          ]
        }
      } as any);

      const autoRes = await aiService.autoTagBookmark({
        bookmarkId,
        userId: 2,
        force: true
      });

      expect(autoRes.added).toEqual(expect.arrayContaining(['react', 'javascript', 'frontend']));
      expect(autoRes.tags.map(t => t.name)).toEqual(expect.arrayContaining(['react', 'javascript', 'frontend']));

      // Verify in database tables
      const attached = db.prepare(`
        SELECT t.name FROM tags t
        JOIN bookmark_tags bt ON t.id = bt.tag_id
        WHERE bt.bookmark_id = ?
      `).all(bookmarkId) as { name: string }[];
      expect(attached.map(t => t.name)).toEqual(expect.arrayContaining(['react', 'javascript', 'frontend']));
    });

    it('skips auto-tagging on bookmarks that already have meaningful tags unless force is true', async () => {
      const db = getDb();
      const insertBm = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, ?, ?, ?, 'website')
      `).run(2, 'https://vuejs.org', 'Vue.js', 'Progressive Framework');
      const bmId = insertBm.lastInsertRowid;

      // Add existing tag
      const tagId = (db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?) RETURNING id').get('vue') as any)?.id
        || (db.prepare('SELECT id FROM tags WHERE name = ?').get('vue') as any).id;
      db.prepare('INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)').run(bmId, tagId);

      const spy = jest.spyOn(axios, 'post');

      // Call without force
      const skipRes = await aiService.autoTagBookmark({
        bookmarkId: bmId,
        userId: 2,
        force: false
      });

      expect(skipRes.skipped).toBe(true);
      expect(skipRes.added.length).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    });

    it('allows on-demand card auto-tagging via POST /api/bookmarks/:id/auto-tag', async () => {
      const db = getDb();
      const insertBm = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, ?, ?, ?, 'website')
      `).run(2, 'https://typescriptlang.org', 'TypeScript', 'Typed JavaScript at Any Scale');
      const bmId = insertBm.lastInsertRowid;

      jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tags: [],
                  newTags: ['typescript', 'coding']
                })
              }
            }
          ]
        }
      } as any);

      const res = await request(app)
        .post(`/api/bookmarks/${bmId}/auto-tag`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(Number(bmId));
      expect(res.body.tags.map((t: any) => t.name)).toEqual(expect.arrayContaining(['typescript', 'coding']));
    });

    it('rejects POST /api/bookmarks/:id/auto-tag for unauthorized user with 404', async () => {
      const db = getDb();
      const insertBm = db.prepare(`
        INSERT INTO bookmarks (user_id, url, title, description, content_type)
        VALUES (?, ?, ?, ?, 'website')
      `).run(1, 'https://admin-only.org', 'Admin Bookmark', 'Secret');
      const bmId = insertBm.lastInsertRowid;

      const res = await request(app)
        .post(`/api/bookmarks/${bmId}/auto-tag`)
        .set('Authorization', `Bearer ${regularToken}`);

      expect(res.status).toBe(404);
    });
  });
});
