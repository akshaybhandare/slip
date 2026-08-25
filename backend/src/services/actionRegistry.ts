/**
 * Action Registry & Capability System (Backend)
 * Minimal declarative single source of truth for Slip and Clip capabilities.
 */

export type ItemType = 'slip' | 'clip';
export type ActionContext = 'feed' | 'clip_detail' | 'recycle_clip';

export type ActionId =
  | 'open_reader'
  | 'open_link'
  | 'share'
  | 'edit'
  | 'pin'
  | 'unpin'
  | 'organize_in_clip'
  | 'remove_from_clip'
  | 'rescrape'
  | 'auto_tag'
  | 'toggle_note'
  | 'delete'
  | 'restore'
  | 'permanent_delete'
  | 'create_subclip'
  | 'rename_clip';

export interface ActionTarget {
  itemType: ItemType;
  item?: any;
  contentType?: string;
  isPinned?: boolean;
  isRecycled?: boolean;
  url?: string;
  isAIConnected?: boolean;
  context: ActionContext;
}

export interface ActionDefinition {
  id: ActionId;
  label: string;
  description: string;
  isDestructive?: boolean;
  isBulkSupported: boolean;
  requiresConfirmation?: boolean;
}

export const ACTION_DEFINITIONS: Record<ActionId, ActionDefinition> = {
  open_reader: { id: 'open_reader', label: 'Open Reader Mode', description: 'Read formatted article or note content in a distraction-free view', isBulkSupported: false },
  open_link: { id: 'open_link', label: 'Open in New Tab', description: 'Open URL or document in a new browser tab', isBulkSupported: false },
  share: { id: 'share', label: 'Share', description: 'Public shareable link', isBulkSupported: false },
  edit: { id: 'edit', label: 'Edit', description: 'Edit title, description, personal note, or tags', isBulkSupported: false },
  pin: { id: 'pin', label: 'Pin to Top', description: 'Pin slip to top of the archive stream', isBulkSupported: false },
  unpin: { id: 'unpin', label: 'Unpin from Top', description: 'Unpin slip from top', isBulkSupported: false },
  organize_in_clip: { id: 'organize_in_clip', label: 'Organize in Clip', description: 'Assign or move slip into a clip collection', isBulkSupported: true },
  remove_from_clip: { id: 'remove_from_clip', label: 'Unclip from this Stack', description: 'Remove slip from the active clip', isBulkSupported: true },
  rescrape: { id: 'rescrape', label: 'Re-scrape Metadata', description: 'Re-fetch title, description, and thumbnail from original URL', isBulkSupported: false },
  auto_tag: { id: 'auto_tag', label: 'Auto-tag with AI', description: 'Automatically generate tags using connected AI provider', isBulkSupported: false },
  toggle_note: { id: 'toggle_note', label: 'Personal Note', description: 'Show or hide personal sticky note drawer', isBulkSupported: false },
  delete: { id: 'delete', label: 'Move to Recycle Clip', description: 'Soft delete item and move to Recycle Clip', isDestructive: true, isBulkSupported: true },
  restore: { id: 'restore', label: 'Restore', description: 'Restore item from Recycle Clip back to active archive', isBulkSupported: true },
  permanent_delete: { id: 'permanent_delete', label: 'Delete Forever', description: 'Permanently eradicate item from database', isDestructive: true, isBulkSupported: true, requiresConfirmation: true },
  create_subclip: { id: 'create_subclip', label: 'New Sub-Clip', description: 'Create a nested sub-clip inside active clip', isBulkSupported: false },
  rename_clip: { id: 'rename_clip', label: 'Rename Clip', description: 'Change name of the clip', isBulkSupported: false }
};

// Universal Action Groups
const UNIVERSAL_SLIP_ACTIONS: ActionId[] = ['edit', 'share', 'pin', 'unpin', 'organize_in_clip', 'delete'];
const UNIVERSAL_CLIP_ACTIONS: ActionId[] = ['rename_clip', 'create_subclip', 'delete'];
const RECYCLE_ACTIONS: ActionId[] = ['restore', 'permanent_delete'];

/**
 * Checks whether an action is supported for a given target.
 */
export function isActionSupported(action: ActionId, target: ActionTarget): boolean {
  const isRecycled = Boolean(target.isRecycled || target.context === 'recycle_clip');

  // Rule 1: Recycle bin items ONLY support restore and permanent_delete
  if (isRecycled) return RECYCLE_ACTIONS.includes(action);
  if (RECYCLE_ACTIONS.includes(action)) return false;

  // Rule 2: Clips support active clip actions
  if (target.itemType === 'clip') return UNIVERSAL_CLIP_ACTIONS.includes(action);

  // Rule 3: Universal active slip actions
  if (UNIVERSAL_SLIP_ACTIONS.includes(action)) {
    if (action === 'pin') return !target.isPinned;
    if (action === 'unpin') return Boolean(target.isPinned);
    return true;
  }

  // Rule 4: Clip detail context action
  if (action === 'remove_from_clip') return target.context === 'clip_detail';

  // Rule 5: Content-type specific slip actions
  const targetUrl = target.url || target.item?.url || '';
  const isNote = target.contentType === 'note' || targetUrl.startsWith('slip://note/');
  const isDoc = target.contentType === 'document' || targetUrl.endsWith('.pdf') || target.item?.image_path?.endsWith('.pdf');
  const isLocalImg = target.contentType === 'image' && (targetUrl.startsWith('/api/cache') || targetUrl.startsWith('local://'));

  switch (action) {
    case 'open_reader':
      return isNote || target.contentType === 'article' || Boolean(target.item?.reader_html);
    case 'open_link':
      return !isNote && Boolean(targetUrl);
    case 'toggle_note':
      return !isNote;
    case 'rescrape':
      return !isNote && !isDoc && !isLocalImg && /^https?:\/\//i.test(targetUrl);
    case 'auto_tag':
      return Boolean(target.isAIConnected) && !isDoc && !isLocalImg;
    default:
      return false;
  }
}

/**
 * Returns all available action definitions for a target item.
 */
export function getSupportedActions(target: ActionTarget): ActionDefinition[] {
  return Object.values(ACTION_DEFINITIONS).filter((def) => isActionSupported(def.id, target));
}

/**
 * Evaluates bulk actions available for a combined selection of slips and clips.
 */
export function getSupportedBulkActions(params: {
  slipCount: number;
  clipCount: number;
  context: ActionContext;
}): ActionDefinition[] {
  const totalCount = params.slipCount + params.clipCount;
  if (totalCount === 0) return [];

  if (params.context === 'recycle_clip') {
    return [ACTION_DEFINITIONS.restore, ACTION_DEFINITIONS.permanent_delete];
  }

  const actions: ActionDefinition[] = [ACTION_DEFINITIONS.delete];
  if (params.context === 'clip_detail' && params.clipCount === 0 && params.slipCount > 0) {
    actions.push(ACTION_DEFINITIONS.remove_from_clip);
  }

  return actions;
}
