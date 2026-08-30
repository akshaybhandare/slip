import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import {
  getEmbeddingStatus,
  reindexAllUserBookmarks,
  suggestTagsForBookmark
} from '../services/embeddingService';

const router = Router();

router.use(authenticate);

/**
 * GET /api/embeddings/status
 * Get status of embedding generation and model for current user
 */
router.get('/status', (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const status = getEmbeddingStatus(userId);
    res.status(200).json(status);
  } catch (err: any) {
    console.error('Get embedding status error:', err);
    res.status(500).json({ message: err.message || 'Failed to get embedding status' });
  }
});

/**
 * POST /api/embeddings/reindex
 * Batch re-index all user bookmarks
 */
router.post('/reindex', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  try {
    const result = await reindexAllUserBookmarks(userId);
    res.status(200).json({
      message: `Successfully re-indexed ${result.indexed} of ${result.total} slips`,
      indexed: result.indexed,
      total: result.total
    });
  } catch (err: any) {
    console.error('Re-index embeddings error:', err);
    res.status(500).json({ message: err.message || 'Failed to re-index slips' });
  }
});

/**
 * POST /api/embeddings/suggest-tags
 * Offline tag suggestion based on tag centroids
 */
router.post('/suggest-tags', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { title, description, personal_note, personalNote, raw_text, rawText, limit = 5 } = req.body;

  try {
    const suggestions = await suggestTagsForBookmark(
      {
        title,
        description,
        personal_note: personal_note || personalNote,
        raw_text: raw_text || rawText
      },
      userId,
      Number(limit)
    );
    res.status(200).json(suggestions);
  } catch (err: any) {
    console.error('Suggest tags error:', err);
    res.status(500).json({ message: err.message || 'Failed to suggest tags' });
  }
});

export default router;
