/**
 * Action Registry & Capability System (Frontend)
 * Minimal declarative single source of truth for Slip UI actions, icons, and capability rules.
 */

import {
  ExternalLink,
  Eye,
  Share2,
  Trash2,
  Edit3,
  RefreshCw,
  Sparkles,
  Paperclip,
  Pin,
  PinOff,
  RotateCcw,
  FileText,
  LucideIcon
} from 'lucide-react';
import { Bookmark, Clip, ContentType } from '../types';
import { isNoteSlip, isDocumentSlip, isLocalImageSlip } from '../utils/bookmarkUtils';

export type ActionContext = 'feed' | 'clip_detail' | 'recycle_clip';
export type ItemType = 'slip' | 'clip';

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
  | 'ai_summarize_pdf'
  | 'toggle_note'
  | 'delete'
  | 'restore'
  | 'permanent_delete'
  | 'create_subclip'
  | 'rename_clip';

export interface ActionTarget {
  itemType: ItemType;
  item?: Bookmark | Clip;
  contentType?: ContentType | string;
  isPinned?: boolean;
  isRecycled?: boolean;
  url?: string;
  isAIConnected?: boolean;
  context: ActionContext;
}

export interface ActionMetadata {
  id: ActionId;
  label: string;
  shortLabel?: string;
  description: string;
  icon: LucideIcon;
  isDestructive?: boolean;
  isBulkSupported: boolean;
  requiresConfirmation?: boolean;
}

export const ACTION_REGISTRY: Record<ActionId, ActionMetadata> = {
  open_reader: { id: 'open_reader', label: 'Open Reader Mode', shortLabel: 'Reader', description: 'Read formatted article or note content in a clean distraction-free view', icon: Eye, isBulkSupported: false },
  open_link: { id: 'open_link', label: 'Open in New Tab', shortLabel: 'Open', description: 'Open external URL or document in a new browser tab', icon: ExternalLink, isBulkSupported: false },
  share: { id: 'share', label: 'Share', shortLabel: 'Share', description: 'Generate or manage public shareable link', icon: Share2, isBulkSupported: false },
  edit: { id: 'edit', label: 'Edit Bookmark', shortLabel: 'Edit', description: 'Edit slip title, description, personal note, or tags', icon: Edit3, isBulkSupported: false },
  pin: { id: 'pin', label: 'Pin to Top', shortLabel: 'Pin', description: 'Pin slip to top of the archive stream', icon: Pin, isBulkSupported: false },
  unpin: { id: 'unpin', label: 'Unpin from Top', shortLabel: 'Unpin', description: 'Unpin slip from top', icon: PinOff, isBulkSupported: false },
  organize_in_clip: { id: 'organize_in_clip', label: 'Organize in Clip', shortLabel: 'Clip', description: 'Assign or move slip into a clip collection', icon: Paperclip, isBulkSupported: true },
  remove_from_clip: { id: 'remove_from_clip', label: 'Unclip from this Stack', shortLabel: 'Unclip', description: 'Remove slip from the currently active clip', icon: Paperclip, isBulkSupported: true },
  rescrape: { id: 'rescrape', label: 'Re-scrape Metadata', shortLabel: 'Re-scrape', description: 'Re-fetch title, description, and thumbnail from original URL', icon: RefreshCw, isBulkSupported: false },
  auto_tag: { id: 'auto_tag', label: 'Auto-tag with AI', shortLabel: 'Auto-tag', description: 'Automatically generate relevant tags using connected AI provider', icon: Sparkles, isBulkSupported: false },
  ai_summarize_pdf: { id: 'ai_summarize_pdf', label: 'AI Summarize', shortLabel: 'AI Summarize', description: 'Summarize PDF, generate title, and auto-tag using AI', icon: Sparkles, isBulkSupported: false },
  toggle_note: { id: 'toggle_note', label: 'Personal Note', shortLabel: 'Note', description: 'Show or hide personal sticky note drawer on slip card', icon: FileText, isBulkSupported: false },
  delete: { id: 'delete', label: 'Move to Recycle Clip', shortLabel: 'Delete', description: 'Soft delete item and move it to Recycle Clip', icon: Trash2, isDestructive: true, isBulkSupported: true },
  restore: { id: 'restore', label: 'Restore', shortLabel: 'Restore', description: 'Restore item from Recycle Clip back to active archive', icon: RotateCcw, isBulkSupported: true },
  permanent_delete: { id: 'permanent_delete', label: 'Delete Forever', shortLabel: 'Delete Forever', description: 'Permanently eradicate item from database', icon: Trash2, isDestructive: true, isBulkSupported: true, requiresConfirmation: true },
  create_subclip: { id: 'create_subclip', label: 'New Sub-Clip', shortLabel: 'New Sub-Clip', description: 'Create a nested sub-clip inside active clip', icon: Paperclip, isBulkSupported: false },
  rename_clip: { id: 'rename_clip', label: 'Rename Clip', shortLabel: 'Rename', description: 'Change name of the clip', icon: Edit3, isBulkSupported: false }
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
  const itemObj = (target.item as Bookmark) || { content_type: target.contentType as any, url: target.url };
  const targetUrl = target.url || (target.item as any)?.url || '';
  const isNote = isNoteSlip(itemObj);
  const isDoc = isDocumentSlip(itemObj);
  const isLocalImg = isLocalImageSlip(itemObj);

  switch (action) {
    case 'open_reader':
      return isNote || (!isLocalImg && (
        target.contentType === 'article' ||
        Boolean((target.item as Bookmark)?.reader_html) ||
        (isDoc && ((target.item as Bookmark)?.description?.trim()?.length || 0) >= 60)
      ));
    case 'open_link':
      return !isNote && Boolean(targetUrl);
    case 'toggle_note':
      return !isNote;
    case 'rescrape':
      return !isNote && !isDoc && !isLocalImg && /^https?:\/\//i.test(targetUrl);
    case 'auto_tag':
      return Boolean(target.isAIConnected) && !isDoc && !isLocalImg;
    case 'ai_summarize_pdf':
      return Boolean(target.isAIConnected) && isDoc;
    default:
      return false;
  }
}

/**
 * Returns all supported actions for a specific item in its context
 */
export function getSupportedActionsForItem(target: ActionTarget): ActionMetadata[] {
  return Object.values(ACTION_REGISTRY).filter((def) => isActionSupported(def.id, target));
}

/**
 * Returns supported bulk actions for the current selection and context
 */
export function getSupportedBulkActions(params: {
  slipCount: number;
  clipCount: number;
  context: ActionContext;
}): ActionMetadata[] {
  const totalCount = params.slipCount + params.clipCount;
  if (totalCount === 0) return [];

  if (params.context === 'recycle_clip') {
    return [ACTION_REGISTRY.restore, ACTION_REGISTRY.permanent_delete];
  }

  const actions: ActionMetadata[] = [ACTION_REGISTRY.delete];
  if (params.clipCount === 0 && params.slipCount > 0) {
    actions.push(ACTION_REGISTRY.organize_in_clip);
  }
  if (params.context === 'clip_detail' && params.clipCount === 0 && params.slipCount > 0) {
    actions.push(ACTION_REGISTRY.remove_from_clip);
  }

  return actions;
}
