import request from 'supertest';
import app from '../server';
import { closeDb } from '../db';

describe('Server API Health Check', () => {
  afterAll(() => {
    closeDb();
  });

  test('GET /health and GET /api/health should return 200 and database connection status with version', async () => {
    const response = await request(app).get('/health');
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/json/);
    expect(response.body.status).toBe('healthy');
    expect(response.body.database).toBe('connected');
    expect(response.body.version).toBeDefined();

    const apiHealth = await request(app).get('/api/health');
    expect(apiHealth.status).toBe(200);
    expect(apiHealth.body.version).toBe(response.body.version);
  });

  test('GET /api/version should return app version, name, and node_env', async () => {
    const response = await request(app).get('/api/version');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version');
    expect(response.body.name).toBe('slip');
    expect(response.body).toHaveProperty('node_env');
  });
});
