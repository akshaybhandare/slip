import request from 'supertest';
import app from '../server';
import { closeDb } from '../db';

describe('Server API Health Check', () => {
  afterAll(() => {
    closeDb();
  });

  test('GET /health should return 200 and database connection status', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body).toEqual({
      status: 'healthy',
      database: 'connected'
    });
  });
});
