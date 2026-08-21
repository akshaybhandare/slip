import request from 'supertest';
import axios from 'axios';
import app from '../server';
import { initDb, closeDb, getDb } from '../db';
import { encryptSecret } from '../services/aiCrypto';

describe('AI "Put this where it belongs" Clip Recommendation Tests', () => {
  let userToken: string;
  let otherUserToken: string;
  let userCookie: string;
  let otherUserCookie: string;

  let filamintClipId: number;
  let suppliersClipId: number;
  let chinaSuppliersClipId: number;
  let hobbiesClipId: number;
  let printingClipId: number;
  let otherUserClipId: number;

  let existingSlip1Id: number;
  let existingSlip2Id: number;
  let targetSlipId: number;
  let targetSlip2Id: number;

  beforeAll(async () => {
    initDb(':memory:');

    // Register admin/user 1
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ username: 'recuser', password: 'Password123!' });
    userToken = regRes.body.token;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'recuser', password: 'Password123!' });
    userCookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // Register user 2
    const reg2Res = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ username: 'otherrecuser', password: 'Password123!' });

    const login2Res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'otherrecuser', password: 'Password123!' });
    otherUserToken = login2Res.body.token;
    otherUserCookie = login2Res.headers['set-cookie'][0].split(';')[0];

    // Create Clip hierarchy for User 1:
    // Filamint (root) -> Suppliers -> China
    const c1 = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Filamint' });
    filamintClipId = c1.body.id;

    const c2 = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Suppliers', parentId: filamintClipId });
    suppliersClipId = c2.body.id;

    const c3 = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'China', parentId: suppliersClipId });
    chinaSuppliersClipId = c3.body.id;

    // Hobbies -> 3D Printing
    const c4 = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Hobbies' });
    hobbiesClipId = c4.body.id;

    const c5 = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '3D Printing', parentId: hobbiesClipId });
    printingClipId = c5.body.id;

    // Create clip for User 2 (for isolation test)
    const cOther = await request(app)
      .post('/api/clips')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ name: 'Other User Private Clip' });
    otherUserClipId = cOther.body.id;

    // Create sample slips in China Suppliers clip
    const s1 = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        url: 'https://example.com/supplier1',
        title: 'Shenzhen PLA Raw Material Suppliers',
        description: 'Bulk PLA resin and masterbatch manufacturer in Shenzhen',
        tags: ['supplier', 'pla', 'filament']
      });
    existingSlip1Id = s1.body.id;
    await request(app)
      .post(`/api/clips/${chinaSuppliersClipId}/bookmarks`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: existingSlip1Id });

    const s2 = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        url: 'https://example.com/supplier2',
        title: 'Dongguan Extrusion Factory Contact',
        description: 'FOB pricing for bulk PLA spools',
        tags: ['supplier', 'pricing']
      });
    existingSlip2Id = s2.body.id;
    await request(app)
      .post(`/api/clips/${chinaSuppliersClipId}/bookmarks`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: existingSlip2Id });

    // Target Slip 1: Note with pricing and PLA supplier info
    const target1 = await request(app)
      .post('/api/bookmarks/note')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        title: '₹720/kg, MOQ 300kg, FOB Chennai',
        content: 'PLA high flow filament quote from supplier export division. 300kg MOQ.',
        tags: ['supplier', 'pla']
      });
    targetSlipId = target1.body.id;

    // Target Slip 2: 3D printing guide
    const target2 = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        url: 'https://bambulab.com/x1c-guide',
        title: 'Bambu Lab X1 Carbon Nozzle Maintenance',
        description: 'Guide for clearing clogs in 3D printer hotends',
        tags: ['3d-printing', 'bambulab']
      });
    targetSlip2Id = target2.body.id;
  });

  afterAll(() => {
    closeDb();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('POST /api/clips/recommend returns 400 when AI is not connected', async () => {
    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: targetSlipId });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('AI provider is not connected');
  });

  test('POST /api/clips/recommend returns 400 when bookmarkId is missing', async () => {
    // Connect mock AI in settings
    const db = getDb();
    const configData = {
      provider: 'openai',
      encrypted_api_key: encryptSecret('sk-test-key-mock'),
      masked_api_key: '••••••••••••mock',
      api_url: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      is_connected: true,
      last_tested_at: new Date().toISOString()
    };
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_config', JSON.stringify(configData));

    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('bookmarkId is required');
  });

  test('POST /api/clips/recommend returns 404 for non-existent or other user bookmark', async () => {
    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ bookmarkId: targetSlipId });

    expect(res.status).toBe(404);
  });

  test('recommends appropriate clip with evidence when AI is connected', async () => {
    const mockAxiosPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    clipId: chinaSuppliersClipId,
                    confidence: 94,
                    reason: '4 similar Slips are already there · matching supplier, PLA'
                  }
                ]
              })
            }
          }
        ]
      }
    } as any);

    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: targetSlipId });

    expect(res.status).toBe(200);
    expect(res.body.bookmarkId).toBe(targetSlipId);
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].clipId).toBe(chinaSuppliersClipId);
    expect(res.body.recommendations[0].name).toBe('China');
    expect(res.body.recommendations[0].path).toBe('Filamint → Suppliers → China');
    expect(res.body.recommendations[0].confidence).toBe(94);
    expect(res.body.recommendations[0].reason).toContain('supplier');

    // Verify AI prompt received candidate clips and target slip details
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const sentPayload = mockAxiosPost.mock.calls[0][1] as any;
    expect(sentPayload.messages[1].content).toContain('₹720/kg');
    expect(sentPayload.messages[1].content).toContain('Filamint → Suppliers → China');
  });

  test('supports multiple ranked candidate clips when applicable', async () => {
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    clipId: printingClipId,
                    confidence: 92,
                    reason: 'Direct match for 3D printer maintenance guides and Bambu Lab tag'
                  },
                  {
                    clipId: hobbiesClipId,
                    confidence: 70,
                    reason: 'Parent collection for maker and hardware projects'
                  }
                ]
              })
            }
          }
        ]
      }
    } as any);

    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: targetSlip2Id });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toHaveLength(2);
    expect(res.body.recommendations[0].clipId).toBe(printingClipId);
    expect(res.body.recommendations[0].path).toBe('Hobbies → 3D Printing');
    expect(res.body.recommendations[1].clipId).toBe(hobbiesClipId);
    expect(res.body.recommendations[1].path).toBe('Hobbies');
  });

  test('filters out hallucinated or non-existent clip IDs returned by LLM', async () => {
    jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                recommendations: [
                  {
                    clipId: 999999, // Does not exist
                    confidence: 95,
                    reason: 'Invented non-existent clip'
                  },
                  {
                    clipId: otherUserClipId, // Belongs to other user
                    confidence: 88,
                    reason: 'Clip from different user'
                  },
                  {
                    clipId: filamintClipId,
                    confidence: 78,
                    reason: 'Valid existing root clip'
                  }
                ]
              })
            }
          }
        ]
      }
    } as any);

    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ bookmarkId: targetSlipId });

    expect(res.status).toBe(200);
    // Only the valid clip belonging to user 1 is retained
    expect(res.body.recommendations).toHaveLength(1);
    expect(res.body.recommendations[0].clipId).toBe(filamintClipId);
  });

  test('returns empty recommendations when user has no clips', async () => {
    // Create a bookmark for other user who has only 1 clip, delete that clip first
    await request(app)
      .delete(`/api/clips/${otherUserClipId}?include_children=true`)
      .set('Authorization', `Bearer ${otherUserToken}`);

    const otherBookmark = await request(app)
      .post('/api/bookmarks')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({
        url: 'https://example.com/isolated',
        title: 'Isolated Bookmark'
      });

    const res = await request(app)
      .post('/api/clips/recommend')
      .set('Authorization', `Bearer ${otherUserToken}`)
      .send({ bookmarkId: otherBookmark.body.id });

    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual([]);
  });
});
