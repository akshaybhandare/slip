import React from 'react';
import { CheckSquare, Square, X, Loader2 } from 'lucide-react';
import { ActionId, ActionContext, getSupportedBulkActions } from '../config/actionRegistry';

interface BulkActionBarProps {
  selectedSlipCount: number;
  selectedClipCount: number;
  totalSelectableCount: number;
  context: ActionContext;
  onSelectAll: () => void;
  onClearSelection: () => void;
  isAllSelected: boolean;
  onExecuteBulkAction: (actionId: ActionId) => void;
  isProcessing?: boolean;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedSlipCount,
  selectedClipCount,
  totalSelectableCount,
  context,
  onSelectAll,
  onClearSelection,
  isAllSelected,
  onExecuteBulkAction,
  isProcessing = false
}) => {
  const totalSelected = selectedSlipCount + selectedClipCount;
  if (totalSelected === 0) return null;

  const availableActions = getSupportedBulkActions({
    slipCount: selectedSlipCount,
    clipCount: selectedClipCount,
    context
  });

  const getSelectionSummary = () => {
    const parts: string[] = [];
    if (selectedSlipCount > 0) {
      parts.push(`${selectedSlipCount} ${selectedSlipCount === 1 ? 'slip' : 'slips'}`);
    }
    if (selectedClipCount > 0) {
      parts.push(`${selectedClipCount} ${selectedClipCount === 1 ? 'clip' : 'clips'}`);
    }
    return parts.join(', ');
  };

  return (
    <div className="bulk-action-bar-container" role="toolbar" aria-label="Bulk actions toolbar">
      <div className="bulk-action-bar-dock">
        {/* Left: Selection Counter & Toggle All */}
        <div className="bulk-dock-left">
          <button
            type="button"
            className="bulk-dock-select-all-btn"
            onClick={onSelectAll}
            title={isAllSelected ? 'Deselect all items' : 'Select all items in view'}
          >
            {isAllSelected ? (
              <CheckSquare size={16} className="bulk-checkbox-icon active" />
            ) : (
              <Square size={16} className="bulk-checkbox-icon" />
            )}
            <span className="bulk-dock-select-all-text">
              {isAllSelected ? 'Deselect All' : `Select All (${totalSelectableCount})`}
            </span>
          </button>

          <div className="bulk-dock-counter-pill">
            <span className="bulk-dock-count-number">{totalSelected}</span>
            <span className="bulk-dock-count-label">selected</span>
            <span className="bulk-dock-count-detail">({getSelectionSummary()})</span>
          </div>
        </div>

        {/* Center/Right: Action Buttons from Single Source of Truth Action Registry */}
        <div className="bulk-dock-actions">
          {availableActions.map((action) => {
            const Icon = action.icon;
            const isDanger = Boolean(action.isDestructive);

            return (
              <button
                key={action.id}
                type="button"
                className={`btn bulk-dock-btn ${isDanger ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => onExecuteBulkAction(action.id)}
                disabled={isProcessing}
                title={action.description}
              >
                {isProcessing ? (
                  <Loader2 size={15} className="spin-animation" />
                ) : (
                  <Icon size={15} />
                )}
                <span>
                  {action.id === 'delete'
                    ? `Delete (${totalSelected})`
                    : action.id === 'restore'
                    ? `Restore (${totalSelected})`
                    : action.id === 'permanent_delete'
                    ? `Delete Forever (${totalSelected})`
                    : action.id === 'organize_in_clip'
                    ? `Clip (${totalSelected})`
                    : action.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            className="bulk-dock-close-btn"
            onClick={onClearSelection}
            title="Cancel selection mode"
            aria-label="Cancel selection"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
