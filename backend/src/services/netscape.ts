import * as cheerio from 'cheerio';

export interface ParsedBookmarkImport {
  url: string;
  title: string;
  description?: string;
  tags: string[];
  created_at?: string;
}

export function parseNetscapeHtml(html: string): ParsedBookmarkImport[] {
  const $ = cheerio.load(html);
  const results: ParsedBookmarkImport[] = [];

  $('a').each((_, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');

    if (!href || !/^https?:\/\//i.test(href.trim())) {
      return; // Skip invalid or non-http links
    }

    const url = href.trim();
    const title = $link.text().trim() || new URL(url).hostname;
    
    // Extract tags from TAGS attribute
    const tagsAttr = $link.attr('tags') || $link.attr('TAGS') || '';
    const tags = tagsAttr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Extract folder names as tags
    $link.parents('dl').each((_, dl) => {
      let folderHeader = $(dl).prevAll('dt').first().find('h3');
      if (folderHeader.length === 0) {
        folderHeader = $(dl).prev('h3');
      }
      if (folderHeader.length === 0) {
        folderHeader = $(dl).parent().find('> dt > h3');
      }

      if (folderHeader.length > 0) {
        const folderName = folderHeader.text().trim();
        if (folderName && !['Bookmarks', 'Bookmarks Bar', 'Bookmarks Menu', 'Other Bookmarks'].includes(folderName)) {
          if (!tags.includes(folderName)) {
            tags.push(folderName);
          }
        }
      }
    });

    // Check for following DD description
    let description: string | undefined;
    const nextElem = $link.parent('dt').next();
    if (nextElem.is('dd')) {
      description = nextElem.text().trim();
    }

    // Extract created_at timestamp
    const addDateAttr = $link.attr('add_date') || $link.attr('ADD_DATE');
    let createdAt: string | undefined;
    if (addDateAttr) {
      const epochSec = parseInt(addDateAttr, 10);
      if (!isNaN(epochSec) && epochSec > 0) {
        createdAt = new Date(epochSec * 1000).toISOString();
      }
    }

    results.push({
      url,
      title,
      description: description || '',
      tags,
      created_at: createdAt
    });
  });

  return results;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface BookmarkExportItem {
  id: number;
  url: string;
  title: string;
  description?: string | null;
  created_at: string;
  tags?: { id: number; name: string }[];
}

export function generateNetscapeHtml(bookmarks: BookmarkExportItem[]): string {
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  for (const b of bookmarks) {
    const epochSec = Math.floor(new Date(b.created_at).getTime() / 1000) || Math.floor(Date.now() / 1000);
    const tagList = (b.tags || []).map(t => t.name).join(',');
    const tagsAttr = tagList ? ` TAGS="${escapeHtml(tagList)}"` : '';
    const safeUrl = escapeHtml(b.url);
    const safeTitle = escapeHtml(b.title || b.url);

    html += `    <DT><A HREF="${safeUrl}" ADD_DATE="${epochSec}"${tagsAttr}>${safeTitle}</A>\n`;
    if (b.description && b.description.trim().length > 0) {
      html += `    <DD>${escapeHtml(b.description.trim())}\n`;
    }
  }

  html += `</DL><p>\n`;
  return html;
}
