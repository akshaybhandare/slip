import React, { useState, useEffect } from 'react';
import { Bookmark, ClipRecommendationItem } from '../types';
import { Sparkles, X, Check, Paperclip, ChevronRight, Loader2 } from 'lucide-react';

export interface PutWhereItBelongsToastProps {
  bookmark: Bookmark;
  recommendations: ClipRecommendationItem[];
  onMoveToClip: (bookmarkId: number, clipId: number, clipPath: string) => Promise<void>;
  onChooseAnother: (bookmark: Bookmark) => void;
  onDismiss: () => void;
  isManualTrigger?: boolean;
  queueIndex?: number;
  queueTotal?: number;
}

export const PutWhereItBelongsToast: React.FC<PutWhereItBelongsToastProps> = ({
  bookmark,
  recommendations,
  onMoveToClip,
  onChooseAnother,
  onDismiss,
  isManualTrigger = false,
  queueIndex = 1,
  queueTotal = 1
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isMoving, setIsMoving] = useState(false);
  const [movedSuccess, setMovedSuccess] = useState<string | null>(null);

  // If recommendations array updates, reset selection
  useEffect(() => {
    setSelectedIndex(0);
    setMovedSuccess(null);
  }, [bookmark.id, recommendations]);

  const hasRecommendations = recommendations && recommendations.length > 0;
  const currentRecommendation = hasRecommendations ? recommendations[selectedIndex] || recommendations[0] : null;

  const handleMove = async () => {
    if (!currentRecommendation || isMoving) return;
    setIsMoving(true);
    try {
      await onMoveToClip(bookmark.id, currentRecommendation.clipId, currentRecommendation.path);
      setMovedSuccess(currentRecommendation.path);
      setTimeout(() => {
        onDismiss();
      }, 1200);
    } catch (err) {
      console.error('Failed to move slip to clip:', err);
    } finally {
      setIsMoving(false);
    }
  };

  // If no recommendations were found
  if (!hasRecommendations) {
    return (
      <div className="put-where-toast-wrapper animate-slide-up" role="region" aria-label="Suggested Clip">
        <div className="put-where-toast-container no-match-toast">
          <div className="put-where-header">
            <div className="put-where-title-badge">
              <Sparkles size={14} className="sparkle-icon" />
              <span className="put-where-title">Suggested Clip</span>
              {queueTotal > 1 && (
                <span className="auto-clip-queue-badge">
                  {queueIndex} of {queueTotal}
                </span>
              )}
            </div>
            <button
              type="button"
              className="put-where-close-btn"
              onClick={onDismiss}
              title="Dismiss recommendation"
              aria-label="Dismiss recommendation"
            >
              <X size={14} />
            </button>
          </div>

          <div className="put-where-body">
            <p className="put-where-no-match-text">Couldn't find a strong clip suggestion for this Slip.</p>
          </div>

          <div className="put-where-footer">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                onChooseAnother(bookmark);
              }}
            >
              <Paperclip size={13} />
              <span>Organize manually in Clip</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="put-where-toast-wrapper animate-slide-up" role="region" aria-label="Suggested Clip">
      <div className={`put-where-toast-container ${movedSuccess ? 'toast-success-state' : ''}`}>
        {/* Header */}
        <div className="put-where-header">
          <div className="put-where-title-badge">
            <Sparkles size={14} className="sparkle-icon" />
            <span className="put-where-title">Suggested Clip</span>
            {queueTotal > 1 && (
              <span className="auto-clip-queue-badge">
                {queueIndex} of {queueTotal}
              </span>
            )}
          </div>

          <div className="put-where-header-right">
            {currentRecommendation && currentRecommendation.confidence && (
              <span className="put-where-confidence" title="Recommendation confidence">
                {currentRecommendation.confidence}% match
              </span>
            )}
            <button
              type="button"
              className="put-where-close-btn"
              onClick={onDismiss}
              title="Dismiss recommendation"
              aria-label="Dismiss recommendation"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Target Slip Hint (short snippet) */}
        <div className="put-where-target-summary">
          <span className="put-where-target-title" title={bookmark.title || bookmark.url}>
            {bookmark.title || bookmark.url}
          </span>
        </div>

        {/* Primary Recommended Clip Destination */}
        <div className="put-where-destination-box">
          <div className="put-where-dest-path">
            <Paperclip size={14} className="dest-clip-icon" />
            <span className="dest-path-text">{currentRecommendation?.path}</span>
          </div>
          {currentRecommendation?.reason && (
            <div className="put-where-evidence">
              {currentRecommendation.reason}
            </div>
          )}
        </div>

        {/* Alternative choices if multiple recommendations exist */}
        {recommendations.length > 1 && (
          <div className="put-where-alternatives-row">
            <span className="alt-label">Other matches:</span>
            <div className="alt-pills">
              {recommendations.map((rec, idx) => {
                if (idx === selectedIndex) return null;
                return (
                  <button
                    key={rec.clipId}
                    type="button"
                    className="alt-clip-pill"
                    onClick={() => setSelectedIndex(idx)}
                    title={`Switch to ${rec.path} (${rec.confidence}% match)`}
                  >
                    <span>{rec.name}</span>
                    <span className="alt-pill-score">{rec.confidence}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="put-where-footer">
          {movedSuccess ? (
            <div className="put-where-success-msg">
              <Check size={14} />
              <span>Moved to {movedSuccess}!</span>
            </div>
          ) : (
            <>
              <div className="put-where-actions-left">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm put-where-choose-btn"
                  onClick={() => {
                    onChooseAnother(bookmark);
                  }}
                  disabled={isMoving}
                >
                  <span>Choose another Clip</span>
                </button>
              </div>

              <div className="put-where-actions-right">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm put-where-dismiss-btn"
                  onClick={onDismiss}
                  disabled={isMoving}
                >
                  Dismiss
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm put-where-move-btn"
                  onClick={handleMove}
                  disabled={isMoving}
                >
                  {isMoving ? (
                    <>
                      <Loader2 size={13} className="spin-animation" />
                      <span>Moving to Clip...</span>
                    </>
                  ) : (
                    <>
                      <Check size={13} />
                      <span>Move to Clip</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
