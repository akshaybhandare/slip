import { describe, it, expect } from 'vitest';
import {
  isActionSupported,
  getSupportedActionsForItem,
  getSupportedBulkActions,
  ACTION_REGISTRY,
  ActionId
} from '../config/actionRegistry';
import { Bookmark, Clip } from '../types';

describe('Action Registry & Capability Matrix (Frontend)', () => {
  describe('ACTION_REGISTRY integrity', () => {
    it('contains metadata and icons for all 16 core actions', () => {
      const actionIds: ActionId[] = [
        'open_reader',
        'open_link',
        'share',
        'edit',
        'pin',
        'unpin',
        'organize_in_clip',
        'remove_from_clip',
        'rescrape',
        'auto_tag',
        'toggle_note',
        'delete',
        'restore',
        'permanent_delete',
        'create_subclip',
        'rename_clip'
      ];

      for (const id of actionIds) {
        const action = ACTION_REGISTRY[id];
        expect(action).toBeDefined();
        expect(action.id).toBe(id);
        expect(action.label).toBeTruthy();
        expect(action.icon).toBeDefined();
      }
    });
  });

  describe('Slip Types Capabilities (Preserves Previous Behaviors)', () => {
    // 1. Markdown Note
    it('supports appropriate actions for a Markdown Note slip', () => {
      const noteBookmark: Partial<Bookmark> = {
        id: 1,
        url: 'slip://note/1700000000000',
        title: 'Meeting Notes',
        content_type: 'note',
        personal_note: '# Meeting Notes\n- item 1'
      };

      const target = {
        itemType: 'slip' as const,
        item: noteBookmark as Bookmark,
        contentType: noteBookmark.content_type,
        url: noteBookmark.url,
        context: 'feed' as const,
        isAIConnected: true
      };

      expect(isActionSupported('open_reader', target)).toBe(true);
      expect(isActionSupported('share', target)).toBe(true);
      expect(isActionSupported('edit', target)).toBe(true);
      expect(isActionSupported('pin', target)).toBe(true);
      expect(isActionSupported('organize_in_clip', target)).toBe(true);
      expect(isActionSupported('delete', target)).toBe(true);
      expect(isActionSupported('auto_tag', target)).toBe(true);

      // Notes do not have external links, re-scraping, or a separate note drawer
      expect(isActionSupported('open_link', target)).toBe(false);
      expect(isActionSupported('rescrape', target)).toBe(false);
      expect(isActionSupported('toggle_note', target)).toBe(false);
    });

    // 2. Web Article
    it('supports appropriate actions for an Article slip', () => {
      const articleBookmark: Partial<Bookmark> = {
        id: 2,
        url: 'https://news.ycombinator.com',
        title: 'Hacker News',
        content_type: 'article',
        reader_html: '<p>Article body</p>'
      };

      const target = {
        itemType: 'slip' as const,
        item: articleBookmark as Bookmark,
        contentType: articleBookmark.content_type,
        url: articleBookmark.url,
        context: 'feed' as const,
        isAIConnected: true
      };

      expect(isActionSupported('open_reader', target)).toBe(true);
      expect(isActionSupported('open_link', target)).toBe(true);
      expect(isActionSupported('share', target)).toBe(true);
      expect(isActionSupported('edit', target)).toBe(true);
      expect(isActionSupported('pin', target)).toBe(true);
      expect(isActionSupported('organize_in_clip', target)).toBe(true);
      expect(isActionSupported('rescrape', target)).toBe(true);
      expect(isActionSupported('auto_tag', target)).toBe(true);
      expect(isActionSupported('toggle_note', target)).toBe(true);
      expect(isActionSupported('delete', target)).toBe(true);
    });

    // 3. Document / PDF
    it('supports appropriate actions for a PDF Document slip', () => {
      const docBookmark: Partial<Bookmark> = {
        id: 3,
        url: 'https://arxiv.org/pdf/2301.00001.pdf',
        title: 'Deep Learning Paper',
        content_type: 'document'
      };

      const target = {
        itemType: 'slip' as const,
        item: docBookmark as Bookmark,
        contentType: docBookmark.content_type,
        url: docBookmark.url,
        context: 'feed' as const,
        isAIConnected: true
      };

      expect(isActionSupported('open_link', target)).toBe(true);
      expect(isActionSupported('share', target)).toBe(true);
      expect(isActionSupported('edit', target)).toBe(true);
      expect(isActionSupported('pin', target)).toBe(true);
      expect(isActionSupported('organize_in_clip', target)).toBe(true);
      expect(isActionSupported('toggle_note', target)).toBe(true);
      expect(isActionSupported('delete', target)).toBe(true);

      // Documents do not support reader mode, rescraping, or auto-tagging
      expect(isActionSupported('open_reader', target)).toBe(false);
      expect(isActionSupported('rescrape', target)).toBe(false);
      expect(isActionSupported('auto_tag', target)).toBe(false);
    });

    // 4. Local Image
    it('supports appropriate actions for a Local Image slip', () => {
      const imgBookmark: Partial<Bookmark> = {
        id: 4,
        url: '/api/cache/photo_987.jpg',
        title: 'Design Diagram',
        content_type: 'image'
      };

      const target = {
        itemType: 'slip' as const,
        item: imgBookmark as Bookmark,
        contentType: imgBookmark.content_type,
        url: imgBookmark.url,
        context: 'feed' as const,
        isAIConnected: true
      };

      expect(isActionSupported('open_link', target)).toBe(true);
      expect(isActionSupported('share', target)).toBe(true);
      expect(isActionSupported('edit', target)).toBe(true);
      expect(isActionSupported('pin', target)).toBe(true);
      expect(isActionSupported('organize_in_clip', target)).toBe(true);
      expect(isActionSupported('toggle_note', target)).toBe(true);
      expect(isActionSupported('delete', target)).toBe(true);

      // Local images do not support web rescrape, reader mode, or auto-tag
      expect(isActionSupported('rescrape', target)).toBe(false);
      expect(isActionSupported('open_reader', target)).toBe(false);
      expect(isActionSupported('auto_tag', target)).toBe(false);
    });
  });

  describe('Context-Specific Actions', () => {
    it('supports unclip ONLY in clip_detail context', () => {
      expect(
        isActionSupported('remove_from_clip', {
          itemType: 'slip',
          context: 'clip_detail'
        })
      ).toBe(true);

      expect(
        isActionSupported('remove_from_clip', {
          itemType: 'slip',
          context: 'feed'
        })
      ).toBe(false);
    });

    it('supports ONLY restore and permanent_delete in recycle_clip context', () => {
      const recycledTarget = {
        itemType: 'slip' as const,
        context: 'recycle_clip' as const,
        isRecycled: true
      };

      expect(isActionSupported('restore', recycledTarget)).toBe(true);
      expect(isActionSupported('permanent_delete', recycledTarget)).toBe(true);
      expect(isActionSupported('delete', recycledTarget)).toBe(false);
      expect(isActionSupported('edit', recycledTarget)).toBe(false);
      expect(isActionSupported('share', recycledTarget)).toBe(false);
    });
  });

  describe('Clip Capabilities', () => {
    it('supports rename_clip, create_subclip, and delete for active clips', () => {
      const clipTarget = {
        itemType: 'clip' as const,
        context: 'feed' as const
      };

      expect(isActionSupported('rename_clip', clipTarget)).toBe(true);
      expect(isActionSupported('create_subclip', clipTarget)).toBe(true);
      expect(isActionSupported('delete', clipTarget)).toBe(true);
    });
  });

  describe('Bulk Actions resolution', () => {
    it('returns restore and permanent_delete for Recycle Clip', () => {
      const actions = getSupportedBulkActions({ slipCount: 2, clipCount: 1, context: 'recycle_clip' });
      expect(actions.map((a) => a.id)).toEqual(['restore', 'permanent_delete']);
    });

    it('returns delete in main feed', () => {
      const actions = getSupportedBulkActions({ slipCount: 5, clipCount: 2, context: 'feed' });
      expect(actions.map((a) => a.id)).toEqual(['delete']);
    });

    it('returns delete and remove_from_clip for slips inside clip_detail', () => {
      const actions = getSupportedBulkActions({ slipCount: 3, clipCount: 0, context: 'clip_detail' });
      expect(actions.map((a) => a.id)).toEqual(['delete', 'remove_from_clip']);
    });
  });
});
