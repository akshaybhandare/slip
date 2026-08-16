import request from 'supertest';
import app from '../server';
import { initDb, closeDb, getDb } from '../db';

describe('User Authentication & API Key Integrations', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb(); // Initialize clean in-memory database
  });

  afterAll(() => {
    closeDb();
  });

  let authCookie: string;
  let rawApiKey: string;
  let apiKeyId: number;

  test('should register the first user as admin without authentication', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'adminuser',
        password: 'securepassword123'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('userId');
    expect(response.body.message).toMatch(/First administrator registered successfully/);
  });

  test('should fail to register a new user without authentication when users already exist', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'seconduser',
        password: 'securepassword123'
      });

    expect(response.status).toBe(401);
  });

  test('should log in successfully with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'adminuser',
        password: 'securepassword123'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.username).toBe('adminuser');
    expect(response.headers['set-cookie']).toBeDefined();
    
    // Save the session cookie for subsequent requests
    authCookie = response.headers['set-cookie'][0].split(';')[0];
  });

  test('should fail login with invalid password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'adminuser',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid username or password');
  });

  test('should register a second user when authenticated as admin', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Cookie', authCookie)
      .send({
        username: 'seconduser',
        password: 'anothersecurepassword'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('User registered successfully');
  });

  test('should generate an API Key when authenticated via session cookie', async () => {
    const response = await request(app)
      .post('/api/auth/apikey')
      .set('Cookie', authCookie)
      .send({
        name: 'Mobile Client Key'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('apiKey');
    expect(response.body.apiKey).toMatch(/^slip_/);
    
    rawApiKey = response.body.apiKey;
  });

  test('should list generated API key metadatas (excluding raw key and hash)', async () => {
    const response = await request(app)
      .get('/api/auth/apikey')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0]).toHaveProperty('name', 'Mobile Client Key');
    expect(response.body[0]).not.toHaveProperty('token_hash');
    
    apiKeyId = response.body[0].id;
  });

  test('should authenticate route using Bearer API Key in Authorization header', async () => {
    const response = await request(app)
      .get('/api/auth/apikey')
      .set('Authorization', `Bearer ${rawApiKey}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('should reject route requests with invalid Bearer API Key', async () => {
    const response = await request(app)
      .get('/api/auth/apikey')
      .set('Authorization', 'Bearer slip_invalidtokenhash123');

    expect(response.status).toBe(401);
  });

  test('should revoke API key successfully', async () => {
    const response = await request(app)
      .delete(`/api/auth/apikey/${apiKeyId}`)
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('API Key revoked successfully');

    // Verify the revoked key no longer authenticates
    const retryAuth = await request(app)
      .get('/api/auth/apikey')
      .set('Authorization', `Bearer ${rawApiKey}`);

    expect(retryAuth.status).toBe(401);
  });

  test('should log out successfully and clear token cookie', async () => {
    const response = await request(app)
      .post('/api/auth/logout');

    expect(response.status).toBe(200);
    
    // Check cookie clearing header
    const setCookie = response.headers['set-cookie'][0];
    expect(setCookie).toMatch(/token=;/);
  });
});
