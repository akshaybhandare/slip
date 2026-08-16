import axios from 'axios';
import * as cheerio from 'cheerio';
import sanitizeHtml from 'sanitize-html';

export interface ScrapedMetadata {
  url: string;
  title: string;
  description: string;
  contentType: 'article' | 'product' | 'video' | 'image' | 'website';
  readerHtml: string | null;
  rawText: string;
  imageUrl: string | null;
  faviconUrl: string | null;
}

const PRIMARY_USER_AGENT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const FALLBACK_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export function resolveUrl(baseUrl: string, relativePath?: string | null): string | null {
  if (!relativePath) return null;
  try {
    return new URL(relativePath, baseUrl).href;
  } catch {
    return null;
  }
}

export function generateScreenshotUrl(targetUrl: string): string {
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(targetUrl)}?w=720`;
}

export function extractSmartUrlFallback(targetUrl: string): {
  title: string;
  description: string;
  contentType: 'article' | 'product' | 'video' | 'image' | 'website';
} {
  try {
    const parsed = new URL(targetUrl);
    const hostname = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/$/, '');
    const segments = pathname.split('/').filter((s) => s.length > 0 && !/^\d+$/.test(s));

    let derivedTitle = '';
    let category: 'article' | 'product' | 'video' | 'image' | 'website' = 'website';

    const lower = targetUrl.toLowerCase();
    if (
      lower.includes('/torrent/') ||
      lower.includes('/torrents/') ||
      lower.includes('1080p') ||
      lower.includes('720p') ||
      lower.includes('2160p') ||
      lower.includes('web-dl') ||
      lower.includes('bluray') ||
      lower.includes('x264') ||
      lower.includes('h264') ||
      lower.includes('hevc') ||
      lower.includes('youtube.com') ||
      lower.includes('vimeo.com') ||
      lower.includes('imdb.com/title')
    ) {
      category = 'video';
    } else if (lower.includes('/product/') || lower.includes('/dp/') || lower.includes('/item/')) {
      category = 'product';
    } else if (
      lower.includes('/blog/') ||
      lower.includes('/blogs/') ||
      lower.includes('/posts/') ||
      lower.includes('/post/') ||
      lower.includes('/article/') ||
      lower.includes('/articles/') ||
      lower.includes('/news/') ||
      lower.includes('/guide/') ||
      lower.includes('/guides/') ||
      lower.includes('/tutorial/') ||
      lower.includes('/docs/')
    ) {
      category = 'article';
    }

    // Find the most descriptive path segment (longest non-generic segment)
    const descriptiveSegment = [...segments].reverse().find(
      (s) =>
        s.length > 2 &&
        !['torrent', 'torrents', 'title', 'item', 'watch', 'p', 'dp', 'post', 'posts', 'view', 'blog', 'blogs', 'article', 'articles'].includes(s.toLowerCase())
    );

    if (descriptiveSegment) {
      const cleanSlug = decodeURIComponent(descriptiveSegment)
        .replace(/\.(html?|php|asp|jsp)$/i, '')
        .replace(/[-_.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanSlug.length > 0) {
        // Capitalize words nicely
        derivedTitle = cleanSlug
          .split(' ')
          .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
          .join(' ');
      }
    }

    if (!derivedTitle) {
      derivedTitle = hostname;
    }

    return {
      title: derivedTitle,
      description: `Saved link from ${hostname}`,
      contentType: category
    };
  } catch {
    return {
      title: targetUrl,
      description: '',
      contentType: 'website'
    };
  }
}

function isCloudflareOrGenericTitle(title: string, hostname: string): boolean {
  if (!title) return true;
  const lower = title.toLowerCase().trim();
  const hostLower = hostname.toLowerCase();
  return (
    lower === hostLower ||
    lower === `www.${hostLower}` ||
    lower === 'just a moment...' ||
    lower.includes('cloudflare') ||
    lower.includes('attention required') ||
    lower.includes('access denied') ||
    lower.includes('security check') ||
    lower.includes('bot verification') ||
    lower.includes('ddos-guard') ||
    lower.includes('403 forbidden')
  );
}

export function parseHtmlMetadata(html: string, targetUrl: string): ScrapedMetadata {
  const $ = cheerio.load(html);

  // 0. Parse JSON-LD structured metadata if present
  let jsonLdTitle: string | null = null;
  let jsonLdDesc: string | null = null;
  let jsonLdImage: string | null = null;
  let jsonLdType: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '{}');
      const item = Array.isArray(data) ? data[0] : data['@graph'] ? data['@graph'][0] : data;
      if (item) {
        if (item.name || item.headline) jsonLdTitle = (item.name || item.headline).toString();
        if (item.description) jsonLdDesc = item.description.toString();
        if (item.image) {
          jsonLdImage = typeof item.image === 'string' ? item.image : item.image.url || item.image[0] || null;
        }
        if (item['@type']) jsonLdType = item['@type'].toString();
      }
    } catch {
      // Ignore invalid JSON-LD
    }
  });

  // 1. Title Extraction
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  const metaTitle = $('meta[name="title"]').attr('content');
  const htmlTitle = $('title').text();
  const h1Title = $('h1').first().text();

  let title = (ogTitle || twitterTitle || jsonLdTitle || metaTitle || htmlTitle || h1Title || '').trim();

  const fallback = extractSmartUrlFallback(targetUrl);
  let parsedHostname = '';
  try {
    parsedHostname = new URL(targetUrl).hostname;
  } catch {
    parsedHostname = targetUrl;
  }

  // If title is a generic challenge or identical to hostname, use smart slug extractor
  if (isCloudflareOrGenericTitle(title, parsedHostname)) {
    title = fallback.title;
  } else if (fallback.title && fallback.title !== parsedHostname && fallback.title.split(' ').length >= 3) {
    // Check if the static HTML title is a generic homepage template for an SPA deep link
    const slugWords = fallback.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const titleWords = title.toLowerCase().split(/\s+/);
    const hasSlugOverlap = slugWords.some((w) => titleWords.includes(w));

    const lowerTarget = targetUrl.toLowerCase();
    if (
      !hasSlugOverlap &&
      (lowerTarget.includes('/blog/') ||
        lowerTarget.includes('/blogs/') ||
        lowerTarget.includes('/article/') ||
        lowerTarget.includes('/articles/') ||
        lowerTarget.includes('/guide/') ||
        lowerTarget.includes('/guides/'))
    ) {
      title = fallback.title;
    }
  }

  // 2. Description Extraction
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const twitterDesc = $('meta[name="twitter:description"]').attr('content');
  const metaDesc = $('meta[name="description"]').attr('content');
  const description = (ogDesc || twitterDesc || jsonLdDesc || metaDesc || fallback.description || '').trim();

  // 3. Image Extraction
  const ogImage = $('meta[property="og:image"]').attr('content');
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  const firstImg = $('article img, main img, img').first().attr('src');
  const rawImage = ogImage || twitterImage || jsonLdImage || firstImg || null;
  const imageUrl = resolveUrl(targetUrl, rawImage);

  // 4. Favicon Extraction
  const iconRel = $('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').attr('href');
  const faviconUrl = resolveUrl(targetUrl, iconRel || '/favicon.ico');

  // 5. Readability & Clean Content Extraction
  let readerHtml: string | null = null;
  let rawText = description;
  let isArticle = false;

  const articleSelector = $('article, main, .article, .post-content, .entry-content').first();
  const contentElement = articleSelector.length > 0 ? articleSelector : $('body');

  if (contentElement.length > 0) {
    const clone = cheerio.load(contentElement.html() || '');
    clone('script, style, nav, footer, header, noscript, iframe, svg, form, button').remove();
    const cleanText = clone.text().replace(/\s+/g, ' ').trim();

    if (cleanText.length > 200) {
      isArticle = true;
      rawText = cleanText;
      const rawHtml = clone.html() || '';
      readerHtml = sanitizeHtml(rawHtml, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title']
        }
      });
    }
  }

  // 6. Content Type Determination
  let contentType: 'article' | 'product' | 'video' | 'image' | 'website' = 'website';
  const ogType = ($('meta[property="og:type"]').attr('content') || '').toLowerCase();
  const lowerUrl = targetUrl.toLowerCase();

  if (
    lowerUrl.includes('youtube.com/watch') ||
    lowerUrl.includes('youtu.be') ||
    lowerUrl.includes('vimeo.com') ||
    ogType.includes('video') ||
    lowerUrl.includes('/torrent/') ||
    lowerUrl.includes('imdb.com/title')
  ) {
    contentType = 'video';
  } else if (lowerUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
    contentType = 'image';
  } else if (
    $('meta[property="product:price:amount"]').length > 0 ||
    $('[itemtype*="schema.org/Product"]').length > 0 ||
    jsonLdType === 'Product' ||
    lowerUrl.includes('/dp/') ||
    lowerUrl.includes('/product/')
  ) {
    contentType = 'product';
  } else if (
    isArticle ||
    ogType.includes('article') ||
    jsonLdType === 'Article' ||
    jsonLdType === 'NewsArticle' ||
    jsonLdType === 'BlogPosting'
  ) {
    contentType = 'article';
  }

  return {
    url: targetUrl,
    title,
    description,
    contentType,
    readerHtml,
    rawText: rawText || description || title,
    imageUrl,
    faviconUrl
  };
}

export async function scrapeUrl(url: string): Promise<ScrapedMetadata> {
  let targetUrl = url.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = 'https://' + targetUrl;
  }

  if (targetUrl.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
    const filename = targetUrl.split('/').pop()?.split('?')[0] || 'Image';
    return {
      url: targetUrl,
      title: filename,
      description: `Image asset from ${new URL(targetUrl).hostname}`,
      contentType: 'image',
      readerHtml: null,
      rawText: filename,
      imageUrl: targetUrl,
      faviconUrl: resolveUrl(targetUrl, '/favicon.ico')
    };
  }

  let result: ScrapedMetadata;

  try {
    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': PRIMARY_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024,
      validateStatus: (status) => status < 400
    });

    result = parseHtmlMetadata(response.data, targetUrl);
  } catch {
    // Fallback to secondary browser User-Agent if primary fails
    try {
      const fallbackRes = await axios.get(targetUrl, {
        headers: {
          'User-Agent': FALLBACK_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 10000,
        maxContentLength: 5 * 1024 * 1024,
        validateStatus: (status) => status < 400
      });
      result = parseHtmlMetadata(fallbackRes.data, targetUrl);
    } catch {
      // If network unreachable or blocked by Cloudflare (403/503), use smart URL parsing + screenshot fallback
      const fallback = extractSmartUrlFallback(targetUrl);
      return {
        url: targetUrl,
        title: fallback.title,
        description: fallback.description,
        contentType: fallback.contentType,
        readerHtml: null,
        rawText: fallback.title,
        imageUrl: generateScreenshotUrl(targetUrl),
        faviconUrl: resolveUrl(targetUrl, '/favicon.ico')
      };
    }
  }

  // If HTML was a client-side SPA (no article HTML body), but URL path is definitively an article/blog
  const lowerUrl = targetUrl.toLowerCase();
  if (
    result.contentType === 'website' &&
    (lowerUrl.includes('/blog/') ||
      lowerUrl.includes('/blogs/') ||
      lowerUrl.includes('/article/') ||
      lowerUrl.includes('/articles/') ||
      lowerUrl.includes('/guide/') ||
      lowerUrl.includes('/guides/') ||
      lowerUrl.includes('/tutorial/') ||
      lowerUrl.includes('/tutorials/'))
  ) {
    result.contentType = 'article';
  }

  // If no preview image was extracted from HTML, fallback to automatic high-resolution screenshot
  if (!result.imageUrl) {
    result.imageUrl = generateScreenshotUrl(targetUrl);
  }

  return result;
}
