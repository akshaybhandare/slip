import request from 'supertest';
import app from '../server';
import { initDb, closeDb } from '../db';
import { parseNetscapeHtml, generateNetscapeHtml } from '../services/netscape';

describe('Netscape HTML Bookmark Import & Export', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  let authCookie: string;

  const sampleNetscapeHtml = `
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
    <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
    <TITLE>Bookmarks</TITLE>
    <H1>Bookmarks</H1>
    <DL><p>
        <DT><H3 ADD_DATE="1600000000">Engineering</H3>
        <DL><p>
            <DT><A HREF="https://github.com" ADD_DATE="1600000001" TAGS="code,git">GitHub</A>
            <DD>Developer platform and code hosting.
            <DT><A HREF="https://news.ycombinator.com" ADD_DATE="1600000002">Hacker News</A>
        </DL><p>
        <DT><A HREF="javascript:alert(1)">Malicious XSS</A>
        <DT><A HREF="https://kernel.org" ADD_DATE="1600000003" TAGS="linux">Linux Kernel</A>
    </DL><p>
  `;

  describe('Unit Parsing & Generation', () => {
    test('parseNetscapeHtml should extract links, folder tags, and filter malicious schemes', () => {
      const parsed = parseNetscapeHtml(sampleNetscapeHtml);

      expect(parsed.length).toBe(3); // GitHub, Hacker News, Linux Kernel (javascript: omitted)
      
      const github = parsed.find(b => b.url === 'https://github.com');
      expect(github).toBeDefined();
      expect(github!.title).toBe('GitHub');
      expect(github!.description).toBe('Developer platform and code hosting.');
      expect(github!.tags).toEqual(expect.arrayContaining(['code', 'git', 'Engineering']));

      const hn = parsed.find(b => b.url === 'https://news.ycombinator.com');
      expect(hn).toBeDefined();
      expect(hn!.tags).toEqual(expect.arrayContaining(['Engineering']));

      const linux = parsed.find(b => b.url === 'https://kernel.org');
      expect(linux).toBeDefined();
      expect(linux!.tags).toEqual(['linux']);
    });

    test('generateNetscapeHtml should produce valid Netscape HTML export format', () => {
      const sampleItems = [
        {
          id: 1,
          url: 'https://example.com/test',
          title: 'Test Bookmark',
          description: 'A test description',
          created_at: new Date('2025-01-01T12:00:00Z').toISOString(),
          tags: [{ id: 1, name: 'tag1' }, { id: 2, name: 'tag2' }]
        }
      ];

      const exportedHtml = generateNetscapeHtml(sampleItems);

      expect(exportedHtml).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
      expect(exportedHtml).toContain('HREF="https://example.com/test"');
      expect(exportedHtml).toContain('TAGS="tag1,tag2"');
      expect(exportedHtml).toContain('Test Bookmark</A>');
      expect(exportedHtml).toContain('<DD>A test description');
    });
  });

  describe('Integration Endpoints', () => {
    test('setup user for import/export testing', async () => {
      await request(app).post('/api/auth/register').send({
        username: 'iouser',
        password: 'password123'
      });

      const login = await request(app).post('/api/auth/login').send({
        username: 'iouser',
        password: 'password123'
      });
      authCookie = login.headers['set-cookie'][0].split(';')[0];
    });

    test('POST /api/io/import should import parsed bookmarks into database', async () => {
      const response = await request(app)
        .post('/api/io/import')
        .set('Cookie', authCookie)
        .send({
          html: sampleNetscapeHtml
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('importedCount', 3);

      const listRes = await request(app)
        .get('/api/bookmarks')
        .set('Cookie', authCookie);

      expect(listRes.status).toBe(200);
      expect(listRes.body.length).toBe(3);
    });

    test('GET /api/io/export should export user bookmarks as downloadable Netscape HTML', async () => {
      const response = await request(app)
        .get('/api/io/export')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
      expect(response.headers['content-disposition']).toContain('attachment; filename="slip_bookmarks_export.html"');
      
      const exportedHtml = response.text;
      expect(exportedHtml).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
      expect(exportedHtml).toContain('https://github.com');
      expect(exportedHtml).toContain('https://news.ycombinator.com');
      expect(exportedHtml).toContain('https://kernel.org');

      const reParsed = parseNetscapeHtml(exportedHtml);
      expect(reParsed.length).toBe(3);
    });
  });
});
