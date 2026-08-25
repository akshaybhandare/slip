import {
  isActionSupported,
  getSupportedActions,
  getSupportedBulkActions,
  ACTION_DEFINITIONS,
  ActionId
} from '../services/actionRegistry';

describe('Action Registry & Capability Matrix (Backend)', () => {
  describe('ACTION_DEFINITIONS completeness', () => {
    it('defines all 16 required core actions', () => {
      const expectedActions: ActionId[] = [
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

      for (const actionId of expectedActions) {
        expect(ACTION_DEFINITIONS[actionId]).toBeDefined();
        expect(ACTION_DEFINITIONS[actionId].id).toBe(actionId);
        expect(ACTION_DEFINITIONS[actionId].label).toBeTruthy();
      }
    });
  });

  describe('Slip Content Types Capability Matrix', () => {
    // 1. Markdown Note
    describe('Note Slip (content_type = note)', () => {
      const target = {
        itemType: 'slip' as const,
        contentType: 'note',
        url: 'slip://note/12345',
        context: 'feed' as const,
        isAIConnected: true
      };

      it('supports open_reader, share, edit, pin, organize_in_clip, delete, auto_tag', () => {
        expect(isActionSupported('open_reader', target)).toBe(true);
        expect(isActionSupported('share', target)).toBe(true);
        expect(isActionSupported('edit', target)).toBe(true);
        expect(isActionSupported('pin', target)).toBe(true);
        expect(isActionSupported('organize_in_clip', target)).toBe(true);
        expect(isActionSupported('delete', target)).toBe(true);
        expect(isActionSupported('auto_tag', target)).toBe(true);
      });

      it('does not support open_link, rescrape, toggle_note, restore, permanent_delete in feed', () => {
        expect(isActionSupported('open_link', target)).toBe(false);
        expect(isActionSupported('rescrape', target)).toBe(false);
        expect(isActionSupported('toggle_note', target)).toBe(false);
        expect(isActionSupported('restore', target)).toBe(false);
        expect(isActionSupported('permanent_delete', target)).toBe(false);
      });
    });

    // 2. Article Slip
    describe('Article Slip (content_type = article)', () => {
      const target = {
        itemType: 'slip' as const,
        contentType: 'article',
        url: 'https://example.com/blog/ai-future',
        context: 'feed' as const,
        isAIConnected: true
      };

      it('supports open_reader, open_link, share, edit, pin, organize_in_clip, rescrape, auto_tag, toggle_note, delete', () => {
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
    });

    // 3. Document / PDF Slip
    describe('Document Slip (content_type = document)', () => {
      const target = {
        itemType: 'slip' as const,
        contentType: 'document',
        url: 'https://example.com/files/paper.pdf',
        context: 'feed' as const,
        isAIConnected: true
      };

      it('supports open_link, share, edit, pin, organize_in_clip, toggle_note, delete', () => {
        expect(isActionSupported('open_link', target)).toBe(true);
        expect(isActionSupported('share', target)).toBe(true);
        expect(isActionSupported('edit', target)).toBe(true);
        expect(isActionSupported('pin', target)).toBe(true);
        expect(isActionSupported('organize_in_clip', target)).toBe(true);
        expect(isActionSupported('toggle_note', target)).toBe(true);
        expect(isActionSupported('delete', target)).toBe(true);
      });

      it('does not support open_reader, rescrape, or auto_tag on document/pdf', () => {
        expect(isActionSupported('open_reader', target)).toBe(false);
        expect(isActionSupported('rescrape', target)).toBe(false);
        expect(isActionSupported('auto_tag', target)).toBe(false);
      });
    });

    // 4. Local Image Slip
    describe('Local Image Slip', () => {
      const target = {
        itemType: 'slip' as const,
        contentType: 'image',
        url: '/api/cache/img_123.png',
        context: 'feed' as const,
        isAIConnected: true
      };

      it('supports open_link, share, edit, pin, organize_in_clip, toggle_note, delete', () => {
        expect(isActionSupported('open_link', target)).toBe(true);
        expect(isActionSupported('share', target)).toBe(true);
        expect(isActionSupported('edit', target)).toBe(true);
        expect(isActionSupported('pin', target)).toBe(true);
        expect(isActionSupported('organize_in_clip', target)).toBe(true);
        expect(isActionSupported('toggle_note', target)).toBe(true);
        expect(isActionSupported('delete', target)).toBe(true);
      });

      it('does not support rescrape, open_reader, or auto_tag on local image', () => {
        expect(isActionSupported('rescrape', target)).toBe(false);
        expect(isActionSupported('open_reader', target)).toBe(false);
        expect(isActionSupported('auto_tag', target)).toBe(false);
      });
    });
  });

  describe('Context-Specific Behaviors', () => {
    // Clip Detail Context
    it('supports remove_from_clip ONLY in clip_detail context', () => {
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

      expect(
        isActionSupported('remove_from_clip', {
          itemType: 'slip',
          context: 'recycle_clip'
        })
      ).toBe(false);
    });

    // Recycle Clip Context
    it('supports ONLY restore and permanent_delete in recycle_clip context', () => {
      const recycledTarget = {
        itemType: 'slip' as const,
        contentType: 'article',
        context: 'recycle_clip' as const,
        isRecycled: true
      };

      expect(isActionSupported('restore', recycledTarget)).toBe(true);
      expect(isActionSupported('permanent_delete', recycledTarget)).toBe(true);

      expect(isActionSupported('delete', recycledTarget)).toBe(false);
      expect(isActionSupported('edit', recycledTarget)).toBe(false);
      expect(isActionSupported('share', recycledTarget)).toBe(false);
      expect(isActionSupported('pin', recycledTarget)).toBe(false);
      expect(isActionSupported('open_reader', recycledTarget)).toBe(false);
    });
  });

  describe('Clip Entity Capabilities', () => {
    it('supports rename_clip, create_subclip, and delete for active clips', () => {
      const clipTarget = {
        itemType: 'clip' as const,
        context: 'feed' as const
      };

      expect(isActionSupported('rename_clip', clipTarget)).toBe(true);
      expect(isActionSupported('create_subclip', clipTarget)).toBe(true);
      expect(isActionSupported('delete', clipTarget)).toBe(true);
      expect(isActionSupported('restore', clipTarget)).toBe(false);
      expect(isActionSupported('permanent_delete', clipTarget)).toBe(false);
    });

    it('supports restore and permanent_delete for recycled clips', () => {
      const recycledClipTarget = {
        itemType: 'clip' as const,
        context: 'recycle_clip' as const,
        isRecycled: true
      };

      expect(isActionSupported('restore', recycledClipTarget)).toBe(true);
      expect(isActionSupported('permanent_delete', recycledClipTarget)).toBe(true);
      expect(isActionSupported('delete', recycledClipTarget)).toBe(false);
      expect(isActionSupported('rename_clip', recycledClipTarget)).toBe(false);
      expect(isActionSupported('create_subclip', recycledClipTarget)).toBe(false);
    });
  });

  describe('Bulk Actions Resolution (getSupportedBulkActions)', () => {
    it('returns empty array when no items are selected', () => {
      expect(getSupportedBulkActions({ slipCount: 0, clipCount: 0, context: 'feed' })).toEqual([]);
    });

    it('returns delete action for mixed slips and clips in feed', () => {
      const actions = getSupportedBulkActions({ slipCount: 3, clipCount: 2, context: 'feed' });
      expect(actions.map((a) => a.id)).toEqual(['delete']);
    });

    it('returns delete and remove_from_clip when slips are selected inside clip_detail', () => {
      const actions = getSupportedBulkActions({ slipCount: 4, clipCount: 0, context: 'clip_detail' });
      expect(actions.map((a) => a.id)).toEqual(['delete', 'remove_from_clip']);
    });

    it('returns restore and permanent_delete for selections inside recycle_clip', () => {
      const actions = getSupportedBulkActions({ slipCount: 2, clipCount: 1, context: 'recycle_clip' });
      expect(actions.map((a) => a.id)).toEqual(['restore', 'permanent_delete']);
    });
  });
});
