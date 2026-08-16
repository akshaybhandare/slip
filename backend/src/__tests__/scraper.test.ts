import { parseHtmlMetadata, resolveUrl } from '../services/scraper';
import { JobQueue } from '../services/queue';

describe('Scraping Engine & Readability Service', () => {
  describe('HTML Metadata Extraction', () => {
    test('should extract Open Graph metadata and resolve relative image/favicon URLs', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Fallback Title</title>
          <meta property="og:title" content="My Amazing Article" />
          <meta property="og:description" content="A detailed description of the article." />
          <meta property="og:image" content="/assets/cover.jpg" />
          <link rel="icon" href="/static/favicon.png" />
        </head>
        <body>
          <h1>Heading</h1>
        </body>
        </html>
      `;

      const metadata = parseHtmlMetadata(mockHtml, 'https://example.com/blog/post-1');

      expect(metadata.title).toBe('My Amazing Article');
      expect(metadata.description).toBe('A detailed description of the article.');
      expect(metadata.imageUrl).toBe('https://example.com/assets/cover.jpg');
      expect(metadata.faviconUrl).toBe('https://example.com/static/favicon.png');
      expect(metadata.contentType).toBe('website');
    });

    test('should fallback to Twitter cards and standard HTML tags when OG tags are absent', () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Title</title>
          <meta name="description" content="Standard description content." />
          <meta name="twitter:image" content="https://images.example.com/preview.png" />
        </head>
        <body>
          <p>Short snippet</p>
        </body>
        </html>
      `;

      const metadata = parseHtmlMetadata(mockHtml, 'https://example.com/page');

      expect(metadata.title).toBe('Page Title');
      expect(metadata.description).toBe('Standard description content.');
      expect(metadata.imageUrl).toBe('https://images.example.com/preview.png');
      expect(metadata.faviconUrl).toBe('https://example.com/favicon.ico');
    });
  });

  describe('Readability & Content Sanitization', () => {
    test('should extract article text and sanitize unsafe HTML with DOMPurify', () => {
      const articleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Long Form Editorial Article</title>
          <meta property="og:type" content="article" />
        </head>
        <body>
          <header><nav>Navigation links that should be stripped</nav></header>
          <article>
            <h1>Understanding SQLite Architecture</h1>
            <p>SQLite is a C-language library that implements a small, fast, self-contained, high-reliability, full-featured, SQL database engine. SQLite is the most used database engine in the world.</p>
            <p>SQLite is built into all mobile phones and most computers and comes bundled inside countless other applications that people use every day. It provides robust transactional semantics with zero administrative configuration.</p>
            <script>alert("malicious script");</script>
            <img src="valid.png" onerror="alert('xss')" />
          </article>
          <footer>Footer content</footer>
        </body>
        </html>
      `;

      const metadata = parseHtmlMetadata(articleHtml, 'https://example.com/articles/sqlite');

      expect(metadata.contentType).toBe('article');
      expect(metadata.readerHtml).toBeDefined();
      expect(metadata.readerHtml).not.toBeNull();
      // Ensure <script> was stripped
      expect(metadata.readerHtml).not.toContain('<script>');
      expect(metadata.readerHtml).not.toContain('alert("malicious script")');
      // Ensure onerror attribute was sanitized out
      expect(metadata.readerHtml).not.toContain('onerror');
      // Ensure main content is extracted
      expect(metadata.rawText).toContain('SQLite is a C-language library');
    });
  });

  describe('Content Type Categorization', () => {
    test('should detect video content types', () => {
      const mockVideoHtml = `<html><head><title>Video Demo</title></head><body></body></html>`;
      const metadata = parseHtmlMetadata(mockVideoHtml, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(metadata.contentType).toBe('video');
    });

    test('should detect product content types', () => {
      const mockProductHtml = `
        <html>
        <head>
          <title>Mechanical Keyboard</title>
          <meta property="product:price:amount" content="129.99" />
          <meta property="product:price:currency" content="USD" />
        </head>
        <body></body>
        </html>
      `;
      const metadata = parseHtmlMetadata(mockProductHtml, 'https://store.example.com/product/keyboard');
      expect(metadata.contentType).toBe('product');
    });
  });

  describe('Rate-Limited Job Queue', () => {
    test('should enforce max concurrency limit of 2', async () => {
      const queue = new JobQueue(2);
      let activeCount = 0;
      let maxObservedActive = 0;
      const completed: number[] = [];

      const makeTask = (id: number, delayMs: number) => async () => {
        activeCount++;
        if (activeCount > maxObservedActive) {
          maxObservedActive = activeCount;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));

        activeCount--;
        completed.push(id);
        return id;
      };

      const promises = [
        queue.add(makeTask(1, 50)),
        queue.add(makeTask(2, 50)),
        queue.add(makeTask(3, 30)),
        queue.add(makeTask(4, 20)),
        queue.add(makeTask(5, 10))
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([1, 2, 3, 4, 5]);
      expect(maxObservedActive).toBeLessThanOrEqual(2);
      expect(completed.length).toBe(5);
    });
  });
});
