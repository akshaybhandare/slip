import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Eye,
  Edit2,
  Sparkles,
  Check,
  Copy,
  ChevronDown,
  ArrowRight,
  X,
  RotateCw,
  Wand2
} from 'lucide-react';
import {
  renderFormattedNote,
  applyInlineFormatting,
  applyListFormatting,
  handleListEnterKey
} from '../utils/markdown';
import { assistNoteApi, NoteAssistAction } from '../api';
import { copyToClipboard } from '../utils/clipboard';

interface NoteEditorProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  titlePlaceholder?: string;
  contentPlaceholder?: string;
  minHeight?: string;
  autoFocus?: boolean;
  isAIConnected?: boolean;
  onOpenAISettings?: () => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  title,
  onTitleChange,
  content,
  onContentChange,
  titlePlaceholder = 'Note title (optional)',
  contentPlaceholder = 'Start typing your note... Use bullet points, **bold**, *italic*, ~~strikethrough~~, or markdown shortcuts.',
  minHeight = '160px',
  autoFocus = false,
  isAIConnected = true,
  onOpenAISettings
}) => {
  const [previewMode, setPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);

  // AI State
  const [isAIMenuOpen, setIsAIMenuOpen] = useState(false);
  const [isRewriteSubMenuOpen, setIsRewriteSubMenuOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState('');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiProposedTitle, setAiProposedTitle] = useState<string | null>(null);
  const [aiActionType, setAiActionType] = useState<string | null>(null);
  const [aiTargetRange, setAiTargetRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedResult, setCopiedResult] = useState(false);
  const [showNotConnectedBanner, setShowNotConnectedBanner] = useState(false);

  // Selection Tracking
  const [selection, setSelection] = useState<{ start: number; end: number; text: string }>({
    start: 0,
    end: 0,
    text: ''
  });

  const updateSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = start !== end ? content.slice(start, end) : '';
    setSelection({ start, end, text });
  };

  // Close AI dropdown on outside click
  useEffect(() => {
    if (!isAIMenuOpen) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setIsAIMenuOpen(false);
        setIsRewriteSubMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isAIMenuOpen]);

  const handleInlineClick = (prefix: string, suffix = prefix, placeholder = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { newContent, newCursorStart, newCursorEnd } = applyInlineFormatting(
      content,
      start,
      end,
      prefix,
      suffix,
      placeholder
    );

    onContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
      updateSelection();
    }, 0);
  };

  const handleListClick = (type: 'bullet' | 'number' | 'quote') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { newContent, newCursorStart, newCursorEnd } = applyListFormatting(
      content,
      start,
      end,
      type
    );

    onContentChange(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
      updateSelection();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // 1. Smart Enter list continuation
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      const cursorPos = textarea.selectionStart;
      const result = handleListEnterKey(content, cursorPos);
      if (result) {
        e.preventDefault();
        onContentChange(result.newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(result.newCursorPos, result.newCursorPos);
          updateSelection();
        }, 0);
        return;
      }
    }

    // 2. Keyboard shortcuts
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handleInlineClick('**', '**', 'bold text');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        handleInlineClick('*', '*', 'italic text');
      } else if (e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        e.preventDefault();
        handleInlineClick('~~', '~~', 'strikethrough text');
      }
    }
  };

  // --- AI Utilities Action Handler ---
  const handleRunAIAction = async (
    action: NoteAssistAction,
    label: string,
    instruction?: string
  ) => {
    if (!isAIConnected) {
      setShowNotConnectedBanner(true);
      setIsAIMenuOpen(false);
      return;
    }

    setIsAIMenuOpen(false);
    setIsRewriteSubMenuOpen(false);
    setShowNotConnectedBanner(false);
    setAiError(null);
    setCopiedResult(false);

    // Determine target text
    const hasSelection = selection.text.trim().length > 0;
    const targetText = hasSelection ? selection.text : content;
    const range = hasSelection ? selection : { start: 0, end: content.length, text: content };

    if (!targetText.trim() && !title.trim() && action !== 'continue') {
      setAiError('Please write some note content or provide a title first.');
      return;
    }

    setAiTargetRange(range);
    setAiActionType(label);
    setIsAILoading(true);
    setAiStatusMessage(
      action === 'rephrase'
        ? 'AI is rephrasing for clarity...'
        : action === 'fix_grammar'
        ? 'AI is fixing grammar & spelling...'
        : action === 'rewrite'
        ? `AI is rewriting (${instruction || 'style'})...`
        : action === 'title'
        ? 'AI is proposing a title...'
        : 'AI is processing your note...'
    );

    try {
      const response = await assistNoteApi({
        action,
        text: targetText,
        title,
        instruction
      });

      setAiResult(response.result);
      if (response.proposedTitle) {
        setAiProposedTitle(response.proposedTitle);
      }
    } catch (err: any) {
      setAiError(err.message || 'AI request failed. Please check your AI connection in Settings.');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleApplyTitle = (newTitle?: string) => {
    const titleToApply = newTitle || aiProposedTitle || aiResult;
    if (titleToApply) {
      const clean = titleToApply.replace(/^[#\s"']+|["'\s]+$/g, '').trim();
      onTitleChange(clean);
      setAiResult(null);
      setAiProposedTitle(null);
    }
  };

  const handleReplaceTarget = () => {
    if (!aiResult) return;
    if (aiTargetRange && aiTargetRange.start !== aiTargetRange.end) {
      // Replace specific selection
      const before = content.slice(0, aiTargetRange.start);
      const after = content.slice(aiTargetRange.end);
      const newContent = `${before}${aiResult}${after}`;
      onContentChange(newContent);
    } else {
      // Replace entire note
      onContentChange(aiResult);
    }
    setAiResult(null);
  };

  const handleInsertBelow = () => {
    if (!aiResult) return;
    if (aiTargetRange && aiTargetRange.start !== aiTargetRange.end) {
      // Insert after selection
      const before = content.slice(0, aiTargetRange.end);
      const after = content.slice(aiTargetRange.end);
      const separator = before.endsWith('\n') ? '' : '\n\n';
      const newContent = `${before}${separator}${aiResult}${after}`;
      onContentChange(newContent);
    } else {
      // Append to content
      if (!content.trim()) {
        onContentChange(aiResult);
      } else {
        const separator = content.endsWith('\n') ? '\n' : '\n\n';
        onContentChange(`${content}${separator}${aiResult}`);
      }
    }
    setAiResult(null);
  };

  const handleCopyResult = async () => {
    if (!aiResult) return;
    const success = await copyToClipboard(aiResult);
    if (success) {
      setCopiedResult(true);
      setTimeout(() => setCopiedResult(false), 2000);
    }
  };

  const handleDiscardAI = () => {
    setAiResult(null);
    setAiProposedTitle(null);
    setAiError(null);
  };

  const hasActiveSelection = selection.text.trim().length > 0;

  return (
    <div className="note-editor-wrapper">
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Note Title</span>
          {isAIConnected && content.trim().length > 0 && !title.trim() && (
            <button
              type="button"
              className="note-ai-suggest-title-link"
              onClick={() => handleRunAIAction('title', 'Propose Title')}
              title="Generate a title from your note content"
            >
              <Sparkles size={11} />
              <span>Suggest Title</span>
            </button>
          )}
        </label>
        <input
          type="text"
          className="form-input"
          style={{ width: '100%', fontWeight: 600 }}
          placeholder={titlePlaceholder}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          autoFocus={autoFocus}
        />
      </div>

      <div className="form-group" style={{ marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="form-label" style={{ margin: 0 }}>Note Content</label>
            {hasActiveSelection && (
              <span className="note-selection-badge" title="AI utilities will apply to selected text">
                Selection ({selection.text.length} chars)
              </span>
            )}
          </div>

          {/* Distinct Segmented Mode Switcher */}
          <div className="note-mode-segmented-bar">
            <button
              type="button"
              className={`note-mode-tab ${!previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(false)}
            >
              <Edit2 size={12} />
              <span>Write</span>
            </button>
            <button
              type="button"
              className={`note-mode-tab ${previewMode ? 'active' : ''}`}
              onClick={() => setPreviewMode(true)}
            >
              <Eye size={12} />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {!previewMode ? (
          <div className="note-editor-write-container">
            {/* Writing Tools Bar */}
            <div className="note-writing-toolbar">
              <button
                type="button"
                className="toolbar-btn"
                title="Bold (Cmd+B / Ctrl+B)"
                onClick={() => handleInlineClick('**', '**', 'bold text')}
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Italic (Cmd+I / Ctrl+I)"
                onClick={() => handleInlineClick('*', '*', 'italic text')}
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Strikethrough (Cmd+Shift+X)"
                onClick={() => handleInlineClick('~~', '~~', 'strikethrough text')}
              >
                <Strikethrough size={13} />
              </button>
              <div className="toolbar-divider" />
              <button
                type="button"
                className="toolbar-btn"
                title="Bullet List (- item)"
                onClick={() => handleListClick('bullet')}
              >
                <List size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Numbered List (1. item)"
                onClick={() => handleListClick('number')}
              >
                <ListOrdered size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Quote (> quote)"
                onClick={() => handleListClick('quote')}
              >
                <Quote size={13} />
              </button>
              <button
                type="button"
                className="toolbar-btn"
                title="Inline Code (`code`)"
                onClick={() => handleInlineClick('`', '`', 'code')}
              >
                <Code size={13} />
              </button>

              {/* AI Utilities Menu Trigger */}
              <div className="toolbar-divider" />
              <div className="note-ai-menu-wrapper" ref={aiMenuRef}>
                <button
                  type="button"
                  className={`toolbar-btn note-ai-trigger-btn ${isAIMenuOpen ? 'active' : ''} ${isAIConnected ? 'connected' : ''}`}
                  title={isAIConnected ? 'AI Note Utilities (Rephrase, Grammar, Rewrite, Propose Title)' : 'AI Utilities (Requires connected AI provider in Settings)'}
                  onClick={() => {
                    if (!isAIConnected) {
                      setShowNotConnectedBanner((prev) => !prev);
                    } else {
                      setIsAIMenuOpen((prev) => !prev);
                      setIsRewriteSubMenuOpen(false);
                    }
                  }}
                >
                  <Sparkles size={13} className="sparkle-icon" />
                  <span className="note-ai-btn-text">AI Assist</span>
                  <ChevronDown size={11} style={{ opacity: 0.7 }} />
                </button>

                {/* AI Dropdown Menu */}
                {isAIMenuOpen && (
                  <div className="note-ai-dropdown-menu">
                    <div className="note-ai-menu-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Wand2 size={13} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: '12px' }}>AI Note Utilities</span>
                      </div>
                      <span className="note-ai-target-tag">
                        {hasActiveSelection ? 'Selected Text' : 'Full Note'}
                      </span>
                    </div>

                    <div className="note-ai-menu-items">
                      {/* 1. Rephrasing */}
                      <button
                        type="button"
                        className="note-ai-menu-item"
                        onClick={() => handleRunAIAction('rephrase', 'Rephrase')}
                      >
                        <span className="note-ai-item-icon">🔄</span>
                        <div className="note-ai-item-info">
                          <span className="note-ai-item-title">Rephrase</span>
                          <span className="note-ai-item-desc">Improve clarity, tone, and flow</span>
                        </div>
                      </button>

                      {/* 2. Grammar & Spelling */}
                      <button
                        type="button"
                        className="note-ai-menu-item"
                        onClick={() => handleRunAIAction('fix_grammar', 'Fix Grammar & Spelling')}
                      >
                        <span className="note-ai-item-icon">🔤</span>
                        <div className="note-ai-item-info">
                          <span className="note-ai-item-title">Fix Grammar & Spelling</span>
                          <span className="note-ai-item-desc">Correct errors while preserving markdown</span>
                        </div>
                      </button>

                      {/* 3. Rewriting Submenu */}
                      <div className="note-ai-menu-group">
                        <button
                          type="button"
                          className={`note-ai-menu-item group-header ${isRewriteSubMenuOpen ? 'active' : ''}`}
                          onClick={() => setIsRewriteSubMenuOpen((prev) => !prev)}
                        >
                          <span className="note-ai-item-icon">📝</span>
                          <div className="note-ai-item-info">
                            <span className="note-ai-item-title">Rewrite Style...</span>
                            <span className="note-ai-item-desc">Concise, professional, casual, bullets</span>
                          </div>
                          <ChevronDown size={12} className={`sub-arrow ${isRewriteSubMenuOpen ? 'open' : ''}`} />
                        </button>

                        {isRewriteSubMenuOpen && (
                          <div className="note-ai-submenu">
                            <button
                              type="button"
                              className="note-ai-submenu-item"
                              onClick={() => handleRunAIAction('rewrite', 'Make Concise', 'concise')}
                            >
                              ⚡ <strong>Make Concise</strong> — Cut fluff & be punchy
                            </button>
                            <button
                              type="button"
                              className="note-ai-submenu-item"
                              onClick={() => handleRunAIAction('rewrite', 'Professional Tone', 'professional')}
                            >
                              👔 <strong>Professional</strong> — Formal and articulate
                            </button>
                            <button
                              type="button"
                              className="note-ai-submenu-item"
                              onClick={() => handleRunAIAction('rewrite', 'Casual Tone', 'casual')}
                            >
                              ☕ <strong>Casual & Friendly</strong> — Conversational
                            </button>
                            <button
                              type="button"
                              className="note-ai-submenu-item"
                              onClick={() => handleRunAIAction('rewrite', 'To Bullet Points', 'bullets')}
                            >
                              📋 <strong>To Bullet Points</strong> — Structured list
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 4. Propose Title */}
                      <button
                        type="button"
                        className="note-ai-menu-item"
                        onClick={() => handleRunAIAction('title', 'Propose Title')}
                      >
                        <span className="note-ai-item-icon">🏷️</span>
                        <div className="note-ai-item-info">
                          <span className="note-ai-item-title">Propose Title</span>
                          <span className="note-ai-item-desc">Generate title from note content</span>
                        </div>
                      </button>

                      {/* Custom Prompt Input */}
                      <div className="note-ai-custom-prompt-row">
                        <input
                          type="text"
                          className="note-ai-custom-input"
                          placeholder="Custom instruction (e.g. Translate to Spanish...)"
                          value={customPrompt}
                          onChange={(e) => setCustomPrompt(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && customPrompt.trim()) {
                              e.preventDefault();
                              handleRunAIAction('custom', 'Custom Instruction', customPrompt.trim());
                              setCustomPrompt('');
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="note-ai-custom-submit"
                          disabled={!customPrompt.trim()}
                          onClick={() => {
                            if (customPrompt.trim()) {
                              handleRunAIAction('custom', 'Custom Instruction', customPrompt.trim());
                              setCustomPrompt('');
                            }
                          }}
                          title="Run custom AI prompt"
                        >
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              className="form-input note-textarea"
              style={{
                width: '100%',
                minHeight,
                resize: 'vertical',
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
                fontFamily: 'inherit',
                lineHeight: 1.6
              }}
              placeholder={contentPlaceholder}
              value={content}
              onChange={(e) => {
                onContentChange(e.target.value);
                updateSelection();
              }}
              onSelect={updateSelection}
              onKeyUp={updateSelection}
              onMouseUp={updateSelection}
              onKeyDown={handleKeyDown}
            />
          </div>
        ) : (
          <div
            className="note-live-preview"
            style={{
              minHeight,
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              fontSize: '14px',
              lineHeight: 1.6
            }}
          >
            {content.trim() ? (
              renderFormattedNote(content)
            ) : (
              <span style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>Nothing written yet. Click Write to start taking notes.</span>
            )}
          </div>
        )}

        {/* Not Connected Info Banner */}
        {showNotConnectedBanner && !isAIConnected && (
          <div className="note-ai-not-connected-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '13px' }}>
                AI provider is not connected. Connect an AI provider in <strong>Settings</strong> to unlock rephrasing, grammar fixes, rewriting, and title proposals.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              {onOpenAISettings && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setShowNotConnectedBanner(false);
                    onOpenAISettings();
                  }}
                >
                  Connect AI in Settings
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowNotConnectedBanner(false)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* AI Loading State */}
        {isAILoading && (
          <div className="note-ai-loading-card">
            <div className="note-ai-loading-pulse" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RotateCw size={15} className="sparkle-spin" style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{aiStatusMessage}</span>
            </div>
          </div>
        )}

        {/* AI Error State */}
        {aiError && (
          <div className="note-ai-error-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '13px' }}>{aiError}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAiError(null)}
                style={{ padding: '2px 6px', height: 'auto' }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* AI Result Card */}
        {aiResult && !isAILoading && (
          <div className="note-ai-result-card">
            <div className="note-ai-result-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  AI Suggestion: {aiActionType || 'Assistant Result'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDiscardAI}
                title="Close suggestion"
                style={{ padding: '2px 6px', height: '24px' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="note-ai-result-content">
              {renderFormattedNote(aiResult)}
            </div>

            <div className="note-ai-result-actions">
              {aiProposedTitle || aiActionType === 'Propose Title' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleApplyTitle()}
                >
                  <Check size={13} />
                  <span>Apply as Title</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleReplaceTarget}
                  >
                    <Check size={13} />
                    <span>{hasActiveSelection ? 'Replace Selection' : 'Replace Note'}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleInsertBelow}
                  >
                    <span>{hasActiveSelection ? '+ Insert Below' : '+ Append to Note'}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCopyResult}
                title="Copy result to clipboard"
              >
                {copiedResult ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedResult ? 'Copied!' : 'Copy'}</span>
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleDiscardAI}
                style={{ marginLeft: 'auto', color: 'var(--color-muted)' }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

