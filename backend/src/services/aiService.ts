import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getDb } from '../db';
import { decryptSecret } from './aiCrypto';
import { CACHE_DIR, isSafeFilename } from './thumbnail';
const { PDFParse } = require('pdf-parse');

export type AIProviderId = 'openai' | 'claude' | 'gemini' | 'custom';

export const KNOWN_AI_PROVIDERS: Record<AIProviderId, { defaultUrl: string; name: string; defaultModel: string }> = {
  openai: {
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini'
  },
  claude: {
    name: 'Claude',
    defaultUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022'
  },
  gemini: {
    name: 'Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash'
  },
  custom: {
    name: 'Custom',
    defaultUrl: '',
    defaultModel: 'default'
  }
};

export const AUTO_TAG_SYSTEM_PROMPT = `You are an automatic content tagger.

Your task is to assign the most appropriate tags to the provided content.

Rules:

1. Prefer existing tags whenever they accurately describe the content.

2. NEVER create a new tag if an existing tag has the same or substantially similar meaning.
   Treat synonyms, abbreviations, spelling variations, formatting variations, and equivalent terms as the same tag.
   
   Examples:
   - Existing: "bambulab" → NEVER create "bambu-lab"
   - Existing: "bambu-lab" → NEVER create "bambulab"
   - Existing: "3d-printing" → NEVER create "3d-print"
   - Existing: "javascript" → NEVER create "js"
   
   When in doubt, use the existing tag instead of creating a new one.

3. Create a new tag only when no existing tag accurately represents the concept.

4. Do not create tags that are merely more specific versions of an existing tag unless the distinction represents a genuinely different concept.

5. Avoid duplicate, synonymous, redundant, or overlapping tags.

6. Tags should describe meaningful concepts present in the content. Do not speculate or infer information that is not supported by the content.

7. Use as few tags as necessary. Prefer precision over quantity. Assign AT MOST 3 tags in total across both existing and new tags.

8. New tags must be short, clear, lowercase, and reusable across other content.

9. Return only the final result. Do not explain your reasoning.

Return JSON only:

{
  "tags": ["existing-tag-1", "existing-tag-2"],
  "newTags": ["genuinely-new-tag"]
}`;

export const SMART_SEARCH_SYSTEM_PROMPT = `You are an intelligent semantic search, conceptual reasoning, and relevance ranking engine for Slip visual bookmarks.

Your mission is to deeply understand the user's search query — including conversational queries, vague memories, specific sub-topics, synonyms, parent franchises, implied intent, and technical troubleshooting — and identify all relevant bookmarks from the provided candidate list.

### 1. Conceptual & Semantic Association Rules
- **Parent & Sub-Topic Relations**: Always associate sub-topics, spin-offs, characters, and eras with their parent franchise (e.g., "clone wars", "mandalorian", "jedi" -> Star Wars; "spiderman", "avengers", "loki" -> Marvel / MCU; "pixel 9", "android 15" -> Google / Mobile).
- **Problem & Solution Mapping**: Connect symptoms and conversational problem descriptions to guides, tools, and documentation (e.g., "Bambu printers clogging / nozzle stuck" -> hotend maintenance, extruder cold pull, 3D printing troubleshooting).
- **Tech Stack & Concept Equivalents**: Understand technical synonyms, programming libraries, and design patterns (e.g., "fast web server" -> Go, Rust, Actix, Nginx, Bun; "css grid tricks" -> responsive web design, flexbox).
- **Intent & Topical Overlaps**: Connect goals to resources (e.g., "get fit at home" -> bodyweight workout, kettlebell routine, fitness; "cheap dinner idea" -> quick pasta, sheet pan meal, budget recipes).
- **Typo, Shorthand & Compound Words**: Handle conversational phrasing, shorthand, hyphens, and compound words gracefully (e.g., "star-wars", "yt video", "ml papers").

### 2. Candidate Evaluation
Evaluate each candidate using all available metadata: title, description (desc), personal notes (note), tags, and content snippets.

### 3. Relevance Scoring Guidelines (0 - 100)
- **80 - 100 (Direct Match)**: Directly addresses the exact query, topic, or specific entity requested.
- **50 - 79 (Strong Semantic / Franchise Match)**: Belongs to the same franchise, theme, parent topic, or provides a direct solution to the described problem.
- **25 - 49 (Related Concept / Partial Overlap)**: Topically or tangentially connected concept that a user searching for this query would find valuable.
- **0 - 24 (Irrelevant)**: Unrelated topic. Do NOT include in the matches array.

### 4. Ranking & Explanations
- Order matches strictly by score descending (highest relevance first).
- For every match, provide a concise, factual 1-sentence "reason" highlighting WHY it matches the user's intent.
- If no candidates are relevant, return {"matches": []}.

### 5. Output Format
Output valid JSON ONLY matching this exact schema without any markdown formatting or commentary:
{
  "matches": [
    {
      "id": 123,
      "score": 92,
      "reason": "Direct Star Wars universe collection containing films and series from the Clone Wars timeline."
    }
  ]
}`;

export function getActiveAIConfig(): { provider: AIProviderId; apiKey: string; apiUrl: string; model: string } | null {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ai_config') as { value: string } | undefined;
    if (!row || !row.value) return null;
    const parsed = JSON.parse(row.value);
    if (!parsed.is_connected || !parsed.encrypted_api_key) return null;
    const apiKey = decryptSecret(parsed.encrypted_api_key);
    const provider: AIProviderId = parsed.provider || 'openai';
    const defaultModel = KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'gpt-4o-mini';
    return {
      provider,
      apiKey,
      apiUrl: parsed.api_url || (KNOWN_AI_PROVIDERS[provider]?.defaultUrl || ''),
      model: parsed.model || defaultModel
    };
  } catch (err) {
    return null;
  }
}

export function normalizeTag(tag: string): string {
  if (!tag || typeof tag !== 'string') return '';
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[_\s]+/g, '-')
    .replace(/[^\w-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function parseLLMJsonResponse<T = any>(rawText: string): T {
  if (!rawText || typeof rawText !== 'string') return {} as T;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip outer markdown fences only
    const fenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(fenced);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
    }
  }
  return {} as T;
}

export function parseAndSanitizeTags(rawText: string): { tags: string[]; newTags: string[] } {
  const parsed = parseLLMJsonResponse<{ tags?: string[]; newTags?: string[] }>(rawText);
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(normalizeTag).filter(Boolean) : [];
  const newTags = Array.isArray(parsed.newTags) ? parsed.newTags.map(normalizeTag).filter(Boolean) : [];
  return { tags, newTags };
}

export function processTags(
  result: { tags?: string[]; newTags?: string[] },
  existingTags: string[],
  maxTags: number = 3
): string[] {
  // Map normalized tag form -> canonical existing tag name
  const existingMap = new Map<string, string>();
  for (const tag of existingTags) {
    const normalized = normalizeTag(tag);
    if (normalized && !existingMap.has(normalized)) {
      existingMap.set(normalized, tag);
    }
  }

  const finalTags = new Set<string>();

  // 1. Existing tags proposed by LLM:
  // Must actually exist in existingTags (via normalized match)
  if (Array.isArray(result.tags)) {
    for (const tag of result.tags) {
      if (finalTags.size >= maxTags) break;
      const normalized = normalizeTag(tag);
      const existing = existingMap.get(normalized);
      if (existing) {
        finalTags.add(existing);
      }
    }
  }

  // 2. New tags proposed by LLM:
  // If it matches an existing tag, prefer and reuse the canonical existing tag.
  // Otherwise, add the cleanly normalized new tag.
  if (Array.isArray(result.newTags)) {
    for (const tag of result.newTags) {
      if (finalTags.size >= maxTags) break;
      const normalized = normalizeTag(tag);
      if (!normalized) continue;

      const existing = existingMap.get(normalized);
      if (existing) {
        finalTags.add(existing);
      } else {
        finalTags.add(normalized);
      }
    }
  }

  return Array.from(finalTags).slice(0, maxTags);
}

export async function generateAutoTags(params: {
  content: string;
  existingTags: string[];
  config?: { provider: AIProviderId; apiKey: string; apiUrl?: string; model?: string };
}): Promise<{ tags: string[]; newTags: string[] }> {
  const activeConfig = params.config || getActiveAIConfig();
  if (!activeConfig || !activeConfig.apiKey) {
    return { tags: [], newTags: [] };
  }

  const { provider, apiKey, apiUrl } = activeConfig;
  const model = (activeConfig.model || '').trim() || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'default';
  const existingTagsStr = params.existingTags && params.existingTags.length > 0
    ? JSON.stringify(params.existingTags)
    : '[]';

  const userPrompt = `Existing tags:\n${existingTagsStr}\n\nContent:\n${params.content}`;

  let rawOutput = '';

  try {
    if (provider === 'openai') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.openai.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: AUTO_TAG_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );
      rawOutput = res.data?.choices?.[0]?.message?.content || '';
    } else if (provider === 'claude') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.claude.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/messages`,
        {
          model,
          system: AUTO_TAG_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1024,
          temperature: 0.2
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 15000
        }
      );
      rawOutput = res.data?.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.gemini.defaultUrl;
      const cleanModel = model.replace(/^models\//, '');
      const res = await axios.post(
        `${baseUrl}/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          systemInstruction: {
            parts: [{ text: AUTO_TAG_SYSTEM_PROMPT }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
      rawOutput = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Custom provider (OpenAI compatible)
      const base = apiUrl?.includes('://') ? apiUrl : `https://${apiUrl || ''}`;
      const targetUrl = base.endsWith('/chat/completions') || base.includes('/generate')
        ? base
        : `${base.replace(/\/+$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/slip-archive/slip',
        'X-Title': 'Slip Visual Bookmarks'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const res = await axios.post(
        targetUrl,
        {
          model,
          messages: [
            { role: 'system', content: AUTO_TAG_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 500,
          temperature: 0.2
        },
        {
          headers,
          timeout: 25000
        }
      );
      rawOutput = res.data?.choices?.[0]?.message?.content || res.data?.response || '';
    }
  } catch (err: any) {
    const errorDetail = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'AI request failed';
    throw new Error(`AI Provider Error (${provider} / ${model}): ${errorDetail}`);
  }

  return parseAndSanitizeTags(rawOutput);
}

export async function autoTagBookmark(params: {
  bookmarkId: number | bigint;
  userId: number;
  force?: boolean;
}): Promise<{ tags: { id: number; name: string }[]; added: string[]; skipped?: boolean }> {
  const { bookmarkId, userId, force = false } = params;
  const numericId = Number(bookmarkId);
  const db = getDb();

  const bookmark = db.prepare(`
    SELECT id, user_id, url, title, description, personal_note, content_type, raw_text
    FROM bookmarks
    WHERE id = ? AND user_id = ?
  `).get(numericId, userId) as any;

  if (!bookmark) {
    throw new Error('Bookmark not found');
  }

  // Check allowed types (URLs / web bookmarks & notes)
  const allowedTypes = ['website', 'article', 'video', 'product', 'note'];
  if (!allowedTypes.includes(bookmark.content_type) && !bookmark.url?.startsWith('http') && !bookmark.url?.startsWith('slip://note/')) {
    return { tags: [], added: [], skipped: true };
  }

  const currentTags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `).all(numericId) as { id: number; name: string }[];

  // If not force, check if card already has tags present (excluding default system tags)
  if (!force) {
    const isNote = bookmark.content_type === 'note' || bookmark.url?.startsWith('slip://note/');
    // If note has tags other than default 'note', or if web bookmark has any tags, skip
    const meaningfulTags = currentTags.filter(t => isNote ? t.name !== 'note' : true);
    if (meaningfulTags.length > 0) {
      return { tags: currentTags, added: [], skipped: true };
    }
  }

  const activeConfig = getActiveAIConfig();
  if (!activeConfig) {
    return { tags: currentTags, added: [], skipped: true };
  }

  // Fetch all existing user tags across the system
  const allTags = db.prepare(`SELECT DISTINCT name FROM tags ORDER BY name ASC`).all() as { name: string }[];
  const existingTags = allTags.map(t => t.name);

  // Assemble content
  const contentParts: string[] = [];
  if (bookmark.title) contentParts.push(`Title: ${bookmark.title}`);
  if (bookmark.description) contentParts.push(`Description: ${bookmark.description}`);
  if (bookmark.personal_note) contentParts.push(`Personal Note: ${bookmark.personal_note}`);
  if (bookmark.raw_text && bookmark.raw_text !== bookmark.title && bookmark.raw_text !== bookmark.description) {
    contentParts.push(`Content: ${bookmark.raw_text.slice(0, 2000)}`);
  }
  if (bookmark.url && !bookmark.url.startsWith('slip://')) {
    contentParts.push(`URL: ${bookmark.url}`);
  }

  const content = contentParts.join('\n\n');
  if (!content.trim()) {
    return { tags: currentTags, added: [], skipped: true };
  }

  const rawTagsResult = await generateAutoTags({
    content,
    existingTags,
    config: activeConfig
  });

  const validatedTags = processTags(rawTagsResult, existingTags);
  if (validatedTags.length === 0) {
    return { tags: currentTags, added: [] };
  }

  const findOrCreateTag = db.prepare(`
    INSERT INTO tags (name) VALUES (?)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name
    RETURNING id
  `);

  const linkTag = db.prepare(`
    INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
  `);

  const tx = db.transaction(() => {
    for (const tagName of validatedTags) {
      const clean = tagName.trim().toLowerCase().replace(/^#+/, '');
      if (clean) {
        const tagRecord = findOrCreateTag.get(clean) as { id: number };
        linkTag.run(numericId, tagRecord.id);
      }
    }
  });

  tx();

  const finalTags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `).all(numericId) as { id: number; name: string }[];

  return { tags: finalTags, added: validatedTags };
}

const SEARCH_STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'let', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought',
  'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your',
  'yours', 'yourself', 'yourselves', 'article', 'page', 'post', 'website', 'link', 'find', 'search',
  'looking', 'show', 'remember', 'something'
]);

function extractSearchTokens(query: string): string[] {
  return (query || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 2 && !SEARCH_STOP_WORDS.has(t));
}

export async function performSmartSearch(params: {
  query: string;
  userId: number;
  limit?: number;
  config?: { provider: AIProviderId; apiKey: string; apiUrl?: string; model?: string };
}): Promise<any[]> {
  const { query, userId, limit = 50 } = params;
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return [];

  const db = getDb();
  const activeConfig = params.config || getActiveAIConfig();
  if (!activeConfig || !activeConfig.apiKey) {
    throw new Error('AI provider is not configured or connected. Please connect an AI provider in settings.');
  }

  // 1. Fast Candidate Selection
  const candidateIds = new Set<number>();
  
  // Check total bookmarks for user
  const countRow = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL').get(userId) as { count: number };
  const totalCount = countRow?.count || 0;

  if (totalCount <= 120) {
    // If library <= 120 bookmarks, include all user bookmarks directly for 100% semantic coverage
    const allRows = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC').all(userId) as { id: number }[];
    for (const r of allRows) {
      candidateIds.add(r.id);
    }
  } else {
    // For large libraries (> 120 bookmarks), perform indexed multi-token retrieval
    const tokens = extractSearchTokens(cleanQuery);
    if (tokens.length > 0) {
      const ftsOrQuery = tokens.map(t => `${t}*`).join(' OR ');
      try {
        const ftsMatches = db.prepare(`
          SELECT rowid FROM bookmarks_fts 
          WHERE bookmarks_fts MATCH ? AND rowid IN (SELECT id FROM bookmarks WHERE user_id = ? AND deleted_at IS NULL)
          ORDER BY bm25(bookmarks_fts) ASC
          LIMIT 40
        `).all(ftsOrQuery, userId) as { rowid: number }[];
        for (const m of ftsMatches) {
          candidateIds.add(m.rowid);
        }
      } catch {
        // Fallback
      }

      try {
        const tagConditions = tokens.map(() => 't.name LIKE ?').join(' OR ');
        const tagParams: any[] = [userId];
        for (const t of tokens) {
          tagParams.push(`%${t}%`);
        }
        const tagMatches = db.prepare(`
          SELECT DISTINCT bt.bookmark_id 
          FROM bookmark_tags bt
          JOIN tags t ON bt.tag_id = t.id
          JOIN bookmarks b ON bt.bookmark_id = b.id
          WHERE b.user_id = ? AND b.deleted_at IS NULL AND (${tagConditions})
          LIMIT 25
        `).all(...tagParams) as { bookmark_id: number }[];
        for (const tm of tagMatches) {
          candidateIds.add(tm.bookmark_id);
        }
      } catch {
        // Fallback
      }
    }

    // Always include top recent bookmarks
    const recentRows = db.prepare(`
      SELECT id FROM bookmarks 
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC 
      LIMIT 30
    `).all(userId) as { id: number }[];
    for (const r of recentRows) {
      candidateIds.add(r.id);
      if (candidateIds.size >= 80) break;
    }
  }

  if (candidateIds.size === 0) {
    return [];
  }

  // 2. Fetch data ONLY for candidate IDs (constant minimal memory footprint)
  const candidateIdList = Array.from(candidateIds);
  const candidatePlaceholders = candidateIdList.map(() => '?').join(',');
  const candidateBookmarks = db.prepare(`
    SELECT b.id, b.title, b.description, b.personal_note, b.content_type, b.url,
           substr(b.raw_text, 1, 600) as content_snippet
    FROM bookmarks b
    WHERE b.id IN (${candidatePlaceholders}) AND b.user_id = ? AND b.deleted_at IS NULL
    ORDER BY b.created_at DESC
  `).all(...candidateIdList, userId) as any[];

  if (candidateBookmarks.length === 0) {
    return [];
  }

  // Batch attach tags for candidates in a single query
  const tagRows = db.prepare(`
    SELECT bt.bookmark_id, t.name 
    FROM bookmark_tags bt
    JOIN tags t ON bt.tag_id = t.id
    WHERE bt.bookmark_id IN (${candidatePlaceholders})
  `).all(...candidateIdList) as { bookmark_id: number; name: string }[];

  const tagsByBookmark = new Map<number, string[]>();
  for (const tr of tagRows) {
    if (!tagsByBookmark.has(tr.bookmark_id)) {
      tagsByBookmark.set(tr.bookmark_id, []);
    }
    tagsByBookmark.get(tr.bookmark_id)!.push(tr.name);
  }

  for (const b of candidateBookmarks) {
    b.tags = tagsByBookmark.get(b.id) || [];
  }

  // Format compact candidates payload (max 35 items to ensure compatibility with small & free tier models)
  const topCandidates = candidateBookmarks.slice(0, 35);
  const candidatesPayload = topCandidates.map(b => {
    const item: any = { id: b.id, title: b.title || 'Untitled' };
    if (b.description) item.desc = b.description.slice(0, 140);
    if (b.personal_note) item.note = b.personal_note.slice(0, 140);
    if (b.tags && b.tags.length > 0) item.tags = b.tags;
    if (!b.description && b.content_snippet) item.snippet = b.content_snippet.slice(0, 140);
    return item;
  });

  const userPrompt = `User Search Query: "${cleanQuery}"\n\nCandidate Bookmarks:\n${JSON.stringify(candidatesPayload, null, 2)}`;

  const { provider, apiKey, apiUrl } = activeConfig;
  const model = (activeConfig.model || '').trim() || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'default';

  let rawOutput = '';

  try {
    if (provider === 'openai') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.openai.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: SMART_SEARCH_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.choices?.[0]?.message?.content || '';
    } else if (provider === 'claude') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.claude.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/messages`,
        {
          model,
          system: SMART_SEARCH_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.1
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.gemini.defaultUrl;
      const cleanModel = model.replace(/^models\//, '');
      const res = await axios.post(
        `${baseUrl}/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          systemInstruction: {
            parts: [{ text: SMART_SEARCH_SYSTEM_PROMPT }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000
        }
      );
      rawOutput = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Custom provider (OpenAI compatible / OpenRouter / Ollama)
      const base = apiUrl?.includes('://') ? apiUrl : `https://${apiUrl || ''}`;
      const targetUrl = base.endsWith('/chat/completions') || base.includes('/generate')
        ? base
        : `${base.replace(/\/+$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/slip-archive/slip',
        'X-Title': 'Slip Visual Bookmarks'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      let res: any;
      try {
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'system', content: SMART_SEARCH_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
          },
          {
            headers,
            timeout: 25000
          }
        );
      } catch (firstErr: any) {
        // If provider rejected system role or returned error, try combining instructions into user role
        const combinedPrompt = `${SMART_SEARCH_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'user', content: combinedPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
          },
          {
            headers,
            timeout: 25000
          }
        );
      }
      rawOutput = res.data?.choices?.[0]?.message?.content || res.data?.response || '';
    }
  } catch (err: any) {
    const errorDetail = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'AI request failed';
    throw new Error(`AI Smart Search Error (${provider} / ${model}): ${errorDetail}`);
  }

  // 3. Parse JSON output
  const parsed = parseLLMJsonResponse<{ matches?: any[] }>(rawOutput);

  const rawMatches: any[] = Array.isArray(parsed.matches) ? parsed.matches : [];
  if (rawMatches.length === 0) {
    return [];
  }

  // 4. Map valid candidate matches
  const scoreMap = new Map<number, { score: number; reason: string }>();
  for (const m of rawMatches) {
    const id = Number(m.id);
    const score = typeof m.score === 'number' ? m.score : 50;
    const reason = typeof m.reason === 'string' ? m.reason.trim() : '';
    if (id && score >= 25) {
      scoreMap.set(id, { score, reason });
    }
  }

  if (scoreMap.size === 0) {
    return [];
  }

  // 5. Fetch full bookmark records
  const matchedIds = Array.from(scoreMap.keys());
  const placeholders = matchedIds.map(() => '?').join(',');
  const fullBookmarks = db.prepare(`
    SELECT b.id, b.user_id, b.url, b.title, b.description, b.personal_note, b.content_type,
           b.image_path, b.favicon_path, b.created_at, b.updated_at
    FROM bookmarks b
    WHERE b.id IN (${placeholders}) AND b.user_id = ? AND b.deleted_at IS NULL
  `).all(...matchedIds, userId) as any[];

  const fullTagQuery = db.prepare(`
    SELECT t.id, t.name 
    FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `);

  for (const b of fullBookmarks) {
    b.tags = fullTagQuery.all(b.id);
    const meta = scoreMap.get(b.id);
    b.matchScore = meta?.score || 50;
    b.matchReason = meta?.reason || '';
  }

  // Sort by score descending (preserving LLM ranking)
  fullBookmarks.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));

  return fullBookmarks.slice(0, Number(limit));
}

export async function testProviderConnection(params: {
  provider: AIProviderId;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}): Promise<{ success: boolean; message: string; latencyMs?: number }> {
  const { provider, apiKey, apiUrl, model } = params;
  const trimmedKey = (apiKey || '').trim();
  const trimmedUrl = (apiUrl || '').trim();
  const targetModel = (model || '').trim() || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'default';

  if (provider !== 'custom' && !trimmedKey) {
    return { success: false, message: 'API key is required.' };
  }

  if (provider === 'custom' && !trimmedUrl) {
    return { success: false, message: 'Custom API URL is required.' };
  }

  const startTime = Date.now();

  try {
    if (provider === 'openai') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.openai.defaultUrl;
      const res = await axios.get(`${baseUrl}/models/${targetModel}`, {
        headers: {
          Authorization: `Bearer ${trimmedKey}`
        },
        timeout: 8000,
        validateStatus: () => true
      });

      const latencyMs = Date.now() - startTime;
      if (res.status === 200) {
        return { success: true, message: `Connected to OpenAI model "${targetModel}" successfully (${latencyMs}ms).`, latencyMs };
      } else if (res.status === 404) {
        return { success: false, message: `OpenAI model "${targetModel}" was not found. Please verify the model name.` };
      } else if (res.status === 401) {
        return { success: false, message: 'OpenAI returned 401 Unauthorized: Invalid API key.' };
      }
      return { success: false, message: `OpenAI returned status ${res.status}: ${res.data?.error?.message || 'Error'}` };
    } else if (provider === 'claude') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.claude.defaultUrl;
      const res = await axios.get(`${baseUrl}/models/${targetModel}`, {
        headers: {
          'x-api-key': trimmedKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 8000,
        validateStatus: () => true
      });

      const latencyMs = Date.now() - startTime;
      if (res.status === 200 || res.status === 400) {
        return { success: true, message: `Connected to Anthropic Claude model "${targetModel}" successfully (${latencyMs}ms).`, latencyMs };
      } else if (res.status === 404) {
        return { success: false, message: `Anthropic Claude model "${targetModel}" was not found. Please verify the model name.` };
      } else if (res.status === 401) {
        return { success: false, message: 'Anthropic Claude returned 401 Unauthorized: Invalid API key.' };
      }
      return { success: false, message: `Anthropic API returned status ${res.status}.` };
    } else if (provider === 'gemini') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.gemini.defaultUrl;
      const cleanModel = targetModel.replace(/^models\//, '');
      const res = await axios.get(`${baseUrl}/models/${cleanModel}?key=${encodeURIComponent(trimmedKey)}`, {
        timeout: 8000,
        validateStatus: () => true
      });

      const latencyMs = Date.now() - startTime;
      if (res.status === 200) {
        return { success: true, message: `Connected to Google Gemini model "${cleanModel}" successfully (${latencyMs}ms).`, latencyMs };
      } else if (res.status === 404) {
        return { success: false, message: `Google Gemini model "${cleanModel}" was not found for this API key. Please verify the model name (e.g. gemini-2.5-flash or gemini-2.0-flash).` };
      } else if (res.status === 400 || res.status === 403) {
        return { success: false, message: `Google Gemini authentication failed: ${res.data?.error?.message || 'Invalid API key.'}` };
      }
      return { success: false, message: `Google Gemini returned status ${res.status}.` };
    } else {
      // Custom provider (OpenAI-compatible)
      const base = trimmedUrl.includes('://') ? trimmedUrl : `https://${trimmedUrl}`;
      const targetUrl = base.endsWith('/chat/completions') || base.includes('/generate')
        ? base
        : `${base.replace(/\/+$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/slip-archive/slip',
        'X-Title': 'Slip Visual Bookmarks'
      };
      if (trimmedKey) {
        headers['Authorization'] = `Bearer ${trimmedKey}`;
      }

      const res = await axios.post(
        targetUrl,
        {
          model: targetModel,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        },
        {
          headers,
          timeout: 8000,
          validateStatus: () => true
        }
      );

      const latencyMs = Date.now() - startTime;
      if (res.status === 200) {
        return { success: true, message: `Connected to custom model "${targetModel}" successfully (${latencyMs}ms).`, latencyMs };
      } else if (res.status === 401 || res.status === 403) {
        return { success: false, message: 'Authentication failed: Invalid API key.' };
      } else if (res.status === 404) {
        return { success: false, message: `Model "${targetModel}" or endpoint was not found (404). Please verify the model name and API URL.` };
      } else if (res.status === 400 || res.status === 422) {
        const detail = res.data?.error?.message || res.data?.message || 'Invalid model or parameters.';
        return { success: false, message: `Provider error (${res.status}): ${detail}` };
      } else if (res.status < 500) {
        return { success: true, message: `Custom endpoint responded (${res.status} ${res.statusText}, ${latencyMs}ms).`, latencyMs };
      }
      return { success: false, message: `Custom endpoint returned server error ${res.status}.` };
    }
  } catch (err: any) {
    if (err.response?.status === 401) {
      return { success: false, message: 'Authentication failed: Invalid API key.' };
    }
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return { success: false, message: 'Connection test timed out after 8 seconds.' };
    }
    return { success: false, message: err.message || 'Connection test failed.' };
  }
}

export type NoteAssistAction =
  | 'continue'
  | 'rephrase'
  | 'fix_grammar'
  | 'rewrite'
  | 'propose'
  | 'title'
  | 'custom';

export interface NoteAssistParams {
  action: NoteAssistAction;
  text: string;
  title?: string;
  instruction?: string;
  config?: { provider: AIProviderId; apiKey: string; apiUrl?: string; model?: string };
}

export interface NoteAssistResult {
  result: string;
  proposedTitle?: string;
}

function cleanLLMTextOutput(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  // Strip outer markdown code blocks if the model wrapped the entire output
  if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }
  return cleaned;
}

export async function assistNote(params: NoteAssistParams): Promise<NoteAssistResult> {
  const activeConfig = params.config || getActiveAIConfig();
  if (!activeConfig || !activeConfig.apiKey) {
    throw new Error('AI provider is not configured or connected. Please connect an AI provider in settings.');
  }

  const { action, text = '', title = '', instruction = '' } = params;
  const { provider, apiKey, apiUrl } = activeConfig;
  const model = (activeConfig.model || '').trim() || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'default';

  let systemPrompt = '';
  let userPrompt = '';

  switch (action) {
    case 'continue': {
      systemPrompt = 'You are an intelligent note-taking and writing assistant for Slip. Your goal is to continue or expand notes with clear, thoughtful markdown text. Preserve existing structure, bullet formatting, and tone. Return ONLY the continuation or expansion text without introductory remarks, explanations, or quotes.';
      const contextParts: string[] = [];
      if (title.trim()) contextParts.push(`Note Title: "${title.trim()}"`);
      if (text.trim()) contextParts.push(`Current Note Content:\n${text.trim()}`);
      userPrompt = `${contextParts.join('\n\n')}\n\nTask: Continue writing the note naturally. Expand the thoughts or draft the next logical section in clean markdown.`;
      break;
    }
    case 'rephrase': {
      systemPrompt = 'You are an expert editor and writing coach. Your goal is to rephrase the provided note content to improve clarity, flow, and elegance while preserving the original meaning and markdown structure. Return ONLY the rephrased text without conversational filler, explanations, or quotes.';
      userPrompt = `Note text to rephrase:\n\n${text.trim()}`;
      break;
    }
    case 'fix_grammar': {
      systemPrompt = 'You are a meticulous proofreader and editor. Your goal is to correct all spelling, grammar, punctuation, and typographical mistakes in the provided text. Preserve the original voice, markdown formatting (bold, italic, lists, code), and intent. Return ONLY the corrected text without explanations or commentary.';
      userPrompt = `Note text to proofread and correct:\n\n${text.trim()}`;
      break;
    }
    case 'rewrite': {
      let styleDesc = 'Improve clarity, structure, and tone.';
      const lowerInst = instruction.toLowerCase().trim();
      if (lowerInst.includes('concise') || lowerInst.includes('short')) {
        styleDesc = 'Make the text concise, punchy, and direct while cutting unnecessary words.';
      } else if (lowerInst.includes('professional') || lowerInst.includes('formal')) {
        styleDesc = 'Rewrite with a professional, clear, and articulate tone.';
      } else if (lowerInst.includes('casual') || lowerInst.includes('friendly')) {
        styleDesc = 'Rewrite with an engaging, casual, and friendly conversational tone.';
      } else if (lowerInst.includes('bullet') || lowerInst.includes('list')) {
        styleDesc = 'Structure and organize the key ideas into a clean bulleted markdown list.';
      } else if (instruction.trim()) {
        styleDesc = instruction.trim();
      }

      systemPrompt = 'You are an expert copywriter and editor. Your goal is to rewrite the provided text according to the specified style or goal. Maintain essential meaning and use clean Markdown formatting. Return ONLY the rewritten text without conversational preamble or explanations.';
      userPrompt = `Style/Goal: ${styleDesc}\n\nNote text to rewrite:\n\n${text.trim()}`;
      break;
    }
    case 'propose': {
      let proposeGoal = 'Propose thoughtful next points, related ideas, or action items.';
      const lowerInst = instruction.toLowerCase().trim();
      if (lowerInst.includes('idea') || lowerInst.includes('brainstorm')) {
        proposeGoal = 'Propose creative ideas, related angles, and exploration points.';
      } else if (lowerInst.includes('outline')) {
        proposeGoal = 'Propose a structured markdown outline for this note.';
      } else if (lowerInst.includes('action') || lowerInst.includes('task') || lowerInst.includes('step')) {
        proposeGoal = 'Propose concrete action items and next steps.';
      } else if (instruction.trim()) {
        proposeGoal = instruction.trim();
      }

      systemPrompt = 'You are a creative brainstorming and strategy partner. Your goal is to propose valuable next points, ideas, outlines, or action items based on the provided note context. Format your response cleanly using Markdown bullet points and bold headers where appropriate. Return ONLY the proposed content without conversational filler.';
      const contextParts: string[] = [];
      if (title.trim()) contextParts.push(`Note Title: "${title.trim()}"`);
      if (text.trim()) contextParts.push(`Note Content:\n${text.trim()}`);
      userPrompt = `${contextParts.join('\n\n')}\n\nGoal: ${proposeGoal}`;
      break;
    }
    case 'title': {
      systemPrompt = 'You are an expert editor. Propose a short, clear, and descriptive title for the following note. The title should be at most 8 words and capture the main idea. Return ONLY the proposed title text without quotes, markdown headers (#), or conversational filler.';
      userPrompt = `Note Content:\n\n${text.trim() || title.trim()}`;
      break;
    }
    case 'custom':
    default: {
      systemPrompt = 'You are an AI note writing assistant for Slip. Follow the user instruction on the note content carefully. Return ONLY the resulting markdown text without conversational preamble.';
      const contextParts: string[] = [];
      if (instruction.trim()) contextParts.push(`Instruction: ${instruction.trim()}`);
      if (title.trim()) contextParts.push(`Note Title: "${title.trim()}"`);
      if (text.trim()) contextParts.push(`Note Content:\n${text.trim()}`);
      userPrompt = contextParts.join('\n\n');
      break;
    }
  }

  let rawOutput = '';

  try {
    if (provider === 'openai') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.openai.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.choices?.[0]?.message?.content || '';
    } else if (provider === 'claude') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.claude.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/messages`,
        {
          model,
          system: systemPrompt,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.3
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.gemini.defaultUrl;
      const cleanModel = model.replace(/^models\//, '');
      const res = await axios.post(
        `${baseUrl}/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            temperature: 0.3
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000
        }
      );
      rawOutput = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Custom provider
      const base = apiUrl?.includes('://') ? apiUrl : `https://${apiUrl || ''}`;
      const targetUrl = base.endsWith('/chat/completions') || base.includes('/generate')
        ? base
        : `${base.replace(/\/+$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/slip-archive/slip',
        'X-Title': 'Slip Visual Bookmarks'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      let res: any;
      try {
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.3
          },
          {
            headers,
            timeout: 25000
          }
        );
      } catch {
        // Fallback for models without system prompt support
        const combinedPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'user', content: combinedPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.3
          },
          {
            headers,
            timeout: 25000
          }
        );
      }
      rawOutput = res.data?.choices?.[0]?.message?.content || res.data?.response || '';
    }
  } catch (err: any) {
    const errorDetail = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'AI request failed';
    throw new Error(`AI Note Assist Error (${provider} / ${model}): ${errorDetail}`);
  }

  const cleanedResult = cleanLLMTextOutput(rawOutput);
  const proposedTitle = action === 'title' ? cleanedResult.replace(/^[#\s"']+|["'\s]+$/g, '').trim() : undefined;

  return {
    result: cleanedResult,
    proposedTitle
  };
}

export const PDF_SUMMARIZE_SYSTEM_PROMPT = `You are an intelligent PDF document analyzer and automatic content summarizer for Slip.

Your task is to analyze the extracted content of a PDF document and generate a structured title, markdown summary, and tags.

### 1. Title Rules:
- Generate a short, clean, human-readable title (max 8-10 words) that captures the core subject of the PDF.
- Refine or clarify the original filename if helpful, removing extensions, hash strings, and random identifiers.

### 2. Description (Summary) Rules:
- Generate a concise, crisp summary formatted in clean Markdown (2 to 4 bullet points or concise paragraphs).
- Highlight key takeaways, topic overview, methodology, or core findings present in the content.

### 3. Tagging Rules (Uniform System Rules):
1. Prefer existing tags whenever they accurately describe the content.
2. NEVER create a new tag if an existing tag has the same or substantially similar meaning. Treat synonyms, abbreviations, spelling variations, formatting variations, and equivalent terms as the same tag (e.g. "bambulab" <-> "bambu-lab", "3d-printing" <-> "3d-print", "javascript" <-> "js"). When in doubt, use the existing tag.
3. Create a new tag only when no existing tag accurately represents the concept.
4. Do not create tags that are merely more specific versions of an existing tag unless the distinction represents a genuinely different concept.
5. Avoid duplicate, synonymous, redundant, or overlapping tags.
6. Tags must describe meaningful concepts present in the content. Do not speculate or infer information that is not supported by the content.
7. Use as few tags as necessary. Prefer precision over quantity. Assign AT MOST 3 tags in total across both existing and new tags.
8. New tags must be short, clear, lowercase, and reusable across other content.
9. Return only the final result. Do not explain your reasoning.

### Output Format
Return valid JSON ONLY matching this schema without preamble or commentary:
{
  "title": "Short Clean Title",
  "description": "• Key takeaway 1\\n• Key takeaway 2\\n• Key takeaway 3",
  "tags": ["existing-tag-1", "existing-tag-2"],
  "newTags": ["genuinely-new-tag"]
}`;

export async function extractPdfText(
  pdfBuffer: Buffer | Uint8Array,
  maxPages: number = 5,
  maxChars: number = 8000
): Promise<{ text: string; pagesCount: number; totalPages: number }> {
  try {
    const uint8 = pdfBuffer instanceof Uint8Array ? pdfBuffer : new Uint8Array(pdfBuffer);
    const parser = new PDFParse({
      data: uint8,
      disableWorker: true,
      isEvalSupported: false
    });
    const res = await parser.getText({ first: maxPages });
    const pageTexts = (res.pages || []).map((p: any) => p.text || '').join('\n');
    const raw = (res.text || pageTexts).replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    // Clean up page marker noise like "-- 1 of 5 --"
    const cleaned = raw.replace(/-- \d+ of \d+ --/g, '').trim();
    const finalText = cleaned || pageTexts.trim();
    const truncated = finalText.slice(0, maxChars);
    if (truncated.length > 0) {
      return {
        text: truncated,
        pagesCount: res.pages?.length || (res.total ? Math.min(res.total, maxPages) : 1),
        totalPages: res.total || 1
      };
    }
  } catch (err: any) {
    // Parser fallback for environments where PDFParse worker setup fails (e.g. test VMs)
  }

  // Resilient fallback: fast binary stream extractor for uncompressed or raw text streams
  try {
    const buf = Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer);
    const str = buf.toString('binary');
    const pageMatches = str.match(/\/Type\s*\/Page\b/g) || [];
    const totalPages = pageMatches.length;

    const texts: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let m;
    while ((m = tjRegex.exec(str)) !== null) {
      if (m[1].trim()) texts.push(m[1].trim());
    }

    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((m = tjArrayRegex.exec(str)) !== null) {
      const innerTj = m[1].match(/\(([^)]+)\)/g);
      if (innerTj) {
        texts.push(innerTj.map((s) => s.slice(1, -1)).join(' '));
      }
    }

    const combined = texts.join(' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
    return {
      text: combined,
      pagesCount: totalPages > 0 ? totalPages : (combined.length > 0 ? 1 : 0),
      totalPages
    };
  } catch {
    return { text: '', pagesCount: 0, totalPages: 0 };
  }
}

export async function generatePdfSummary(params: {
  text: string;
  filename: string;
  originalTitle?: string;
  existingTags: string[];
  config?: { provider: AIProviderId; apiKey: string; apiUrl?: string; model?: string };
}): Promise<{ title: string; description: string; tags: string[]; newTags: string[] }> {
  const activeConfig = params.config || getActiveAIConfig();
  if (!activeConfig || !activeConfig.apiKey) {
    throw new Error('AI provider is not configured or connected. Please connect an AI provider in settings.');
  }

  const { provider, apiKey, apiUrl } = activeConfig;
  const model = (activeConfig.model || '').trim() || KNOWN_AI_PROVIDERS[provider]?.defaultModel || 'default';
  const existingTagsStr = params.existingTags && params.existingTags.length > 0
    ? JSON.stringify(params.existingTags)
    : '[]';

  let userPrompt = `Existing user tags in library:\n${existingTagsStr}\n\nOriginal PDF Filename / Title: ${params.filename || params.originalTitle || 'Untitled Document'}\n\n`;
  if (params.text && params.text.trim()) {
    userPrompt += `Extracted PDF Text (first pages):\n"""\n${params.text.trim()}\n"""\n\nGenerate structured title, markdown summary, and tags.`;
  } else {
    userPrompt += `Note: The PDF has no extractable text layer (e.g. scanned document or diagram image). Generate a clean, descriptive title based on the filename, a clear markdown note in description stating it is a visual/scanned PDF along with topic info, and 2-3 relevant tags.`;
  }

  let rawOutput = '';

  try {
    if (provider === 'openai') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.openai.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: PDF_SUMMARIZE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.choices?.[0]?.message?.content || '';
    } else if (provider === 'claude') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.claude.defaultUrl;
      const res = await axios.post(
        `${baseUrl}/messages`,
        {
          model,
          system: PDF_SUMMARIZE_SYSTEM_PROMPT,
          messages: [
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.2
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          timeout: 25000
        }
      );
      rawOutput = res.data?.content?.[0]?.text || '';
    } else if (provider === 'gemini') {
      const baseUrl = apiUrl || KNOWN_AI_PROVIDERS.gemini.defaultUrl;
      const cleanModel = model.replace(/^models\//, '');
      const res = await axios.post(
        `${baseUrl}/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          systemInstruction: {
            parts: [{ text: PDF_SUMMARIZE_SYSTEM_PROMPT }]
          },
          contents: [
            {
              parts: [{ text: userPrompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2
          }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 25000
        }
      );
      rawOutput = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // Custom provider (OpenAI compatible)
      const base = apiUrl?.includes('://') ? apiUrl : `https://${apiUrl || ''}`;
      const targetUrl = base.endsWith('/chat/completions') || base.includes('/generate')
        ? base
        : `${base.replace(/\/+$/, '')}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/slip-archive/slip',
        'X-Title': 'Slip Visual Bookmarks'
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      let res: any;
      try {
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'system', content: PDF_SUMMARIZE_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.2
          },
          {
            headers,
            timeout: 25000
          }
        );
      } catch {
        const combinedPrompt = `${PDF_SUMMARIZE_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;
        res = await axios.post(
          targetUrl,
          {
            model,
            messages: [
              { role: 'user', content: combinedPrompt }
            ],
            max_tokens: 1500,
            temperature: 0.2
          },
          {
            headers,
            timeout: 25000
          }
        );
      }
      rawOutput = res.data?.choices?.[0]?.message?.content || res.data?.response || '';
    }
  } catch (err: any) {
    const errorDetail = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'AI request failed';
    throw new Error(`AI PDF Summarize Error (${provider} / ${model}): ${errorDetail}`);
  }

  // Parse JSON response
  const parsed = parseLLMJsonResponse<{ title?: string; description?: string; tags?: string[]; newTags?: string[] }>(rawOutput);

  const title = (parsed.title || '').trim().replace(/^["']+|["']+$/g, '');
  const description = (parsed.description || '').trim();
  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(normalizeTag).filter(Boolean) : [];
  const newTags = Array.isArray(parsed.newTags) ? parsed.newTags.map(normalizeTag).filter(Boolean) : [];

  return { title, description, tags, newTags };
}

export async function summarizePdfBookmark(params: {
  bookmarkId: number | bigint;
  userId: number;
  config?: { provider: AIProviderId; apiKey: string; apiUrl?: string; model?: string };
}): Promise<{
  bookmark: any;
  title: string;
  description: string;
  tags: { id: number; name: string }[];
  pagesExtracted: number;
  extractedChars: number;
}> {
  const { bookmarkId, userId } = params;
  const numericId = Number(bookmarkId);
  const db = getDb();

  const bookmark = db.prepare(`
    SELECT id, user_id, url, title, description, personal_note, content_type, image_path, raw_text
    FROM bookmarks
    WHERE id = ? AND user_id = ? AND deleted_at IS NULL
  `).get(numericId, userId) as any;

  if (!bookmark) {
    throw new Error('Bookmark not found or unauthorized');
  }

  const isDoc = bookmark.content_type === 'document' || bookmark.url?.endsWith('.pdf') || bookmark.image_path?.endsWith('.pdf');
  if (!isDoc) {
    throw new Error('Bookmark is not a PDF document');
  }

  const activeConfig = params.config || getActiveAIConfig();
  if (!activeConfig || !activeConfig.apiKey) {
    throw new Error('AI provider is not configured or connected. Please connect an AI provider in settings.');
  }

  // 1. Retrieve PDF buffer
  let pdfBuffer: Buffer | null = null;
  const localCandidate = bookmark.image_path || bookmark.url;
  if (localCandidate && localCandidate.startsWith('/api/cache/')) {
    const filename = path.basename(localCandidate);
    if (isSafeFilename(filename)) {
      const filePath = path.join(CACHE_DIR, filename);
      if (fs.existsSync(filePath)) {
        pdfBuffer = await fs.promises.readFile(filePath);
      }
    }
  }

  if (!pdfBuffer && bookmark.url && /^https?:\/\//i.test(bookmark.url)) {
    try {
      const res = await axios.get(bookmark.url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 50 * 1024 * 1024,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*'
        }
      });
      pdfBuffer = Buffer.from(res.data);
    } catch (err: any) {
      throw new Error(`Failed to download PDF from URL: ${err.message || 'Network error'}`);
    }
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new Error('Could not retrieve PDF file data');
  }

  // 2. Fast text extraction (first 5 pages, capped at 8000 chars)
  const extraction = await extractPdfText(pdfBuffer, 5, 8000);

  // 3. Fetch existing tags across the system for auto-tagging alignment
  const allTags = db.prepare(`SELECT DISTINCT name FROM tags ORDER BY name ASC`).all() as { name: string }[];
  const existingTags = allTags.map(t => t.name);

  // 4. Derive human-readable filename (avoiding cache sha256 hashes)
  let filename = '';
  const descFileMatch = bookmark.description ? bookmark.description.match(/Uploaded (?:document|file):\s*([^\s()]+\.pdf)/i) : null;
  if (descFileMatch && !/^[a-f0-9]{32,}\.pdf$/i.test(descFileMatch[1])) {
    filename = descFileMatch[1];
  } else if (bookmark.title && bookmark.title.toLowerCase().endsWith('.pdf') && !/^[a-f0-9]{32,}\.pdf$/i.test(bookmark.title)) {
    filename = bookmark.title;
  } else if (bookmark.url && !bookmark.url.startsWith('/api/cache/')) {
    try {
      const parsedUrl = new URL(bookmark.url);
      const urlBase = path.basename(parsedUrl.pathname);
      if (urlBase && urlBase.toLowerCase().endsWith('.pdf') && !/^[a-f0-9]{32,}\.pdf$/i.test(urlBase)) {
        filename = decodeURIComponent(urlBase);
      }
    } catch {}
  }
  if (!filename && bookmark.title && !/^[a-f0-9]{32,}/i.test(bookmark.title)) {
    const slug = bookmark.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    filename = slug ? `${slug}.pdf` : 'document.pdf';
  }
  if (!filename) {
    filename = 'document.pdf';
  }

  // 5. Call AI
  const aiResult = await generatePdfSummary({
    text: extraction.text,
    filename,
    originalTitle: bookmark.title,
    existingTags,
    config: activeConfig
  });

  const finalTitle = aiResult.title.slice(0, 150) || bookmark.title;

  // Preserve uploaded document size/type metadata if present
  const uploadMetaMatch = bookmark.description ? bookmark.description.match(/(Uploaded (?:document|file|image)(?::\s*[^\s()]+)?\s*\([^)]+\))/i) : null;
  const uploadMeta = uploadMetaMatch
    ? uploadMetaMatch[1]
    : (pdfBuffer ? `Uploaded document: ${filename} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB, application/pdf)` : '');

  let finalDesc = aiResult.description || bookmark.description || '';
  if (uploadMeta && !finalDesc.includes(uploadMeta)) {
    finalDesc = `${finalDesc.trim()}\n\n${uploadMeta}`.trim();
  }

  const validatedTags = processTags(aiResult, existingTags, 3);

  // 6. Persist to DB in a transaction
  const findOrCreateTag = db.prepare(`
    INSERT INTO tags (name) VALUES (?)
    ON CONFLICT(name) DO UPDATE SET name=excluded.name
    RETURNING id
  `);

  const linkTag = db.prepare(`
    INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)
  `);

  const updatedRawText = `${finalTitle}\n${finalDesc}\n${extraction.text.slice(0, 1000)}`;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE bookmarks
      SET title = ?, description = ?, raw_text = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `).run(finalTitle, finalDesc, updatedRawText, numericId, userId);

    // Keep default 'document' & 'pdf' tags if present, and add the new validated tags
    const tagSet = new Set<string>(['document', 'pdf', ...validatedTags]);
    for (const tagName of tagSet) {
      const clean = normalizeTag(tagName);
      if (clean) {
        const tagRecord = findOrCreateTag.get(clean) as { id: number };
        linkTag.run(numericId, tagRecord.id);
      }
    }
  });

  tx();

  // 7. Return refreshed bookmark
  const updatedBookmark = db.prepare(`
    SELECT * FROM bookmarks WHERE id = ?
  `).get(numericId) as any;

  const finalTags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN bookmark_tags bt ON t.id = bt.tag_id
    WHERE bt.bookmark_id = ?
  `).all(numericId) as { id: number; name: string }[];

  updatedBookmark.tags = finalTags;

  return {
    bookmark: updatedBookmark,
    title: finalTitle,
    description: finalDesc,
    tags: finalTags,
    pagesExtracted: extraction.pagesCount,
    extractedChars: extraction.text.length
  };
}
