import React from 'react';

/**
 * Render inline markdown tokens: bold (**), italic (*), strikethrough (~~), and code (`)
 * Avoids dangerouslySetInnerHTML completely for 100% XSS safety.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  const tokens: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/`([^`]+)`/);
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const strikeMatch = remaining.match(/~~([^~]+)~~/);
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    const matches = [
      codeMatch ? { type: 'code', index: codeMatch.index!, length: codeMatch[0].length, content: codeMatch[1] } : null,
      boldMatch ? { type: 'bold', index: boldMatch.index!, length: boldMatch[0].length, content: boldMatch[1] } : null,
      strikeMatch ? { type: 'strike', index: strikeMatch.index!, length: strikeMatch[0].length, content: strikeMatch[1] } : null,
      italicMatch ? { type: 'italic', index: italicMatch.index!, length: italicMatch[0].length, content: italicMatch[1] } : null
    ].filter(Boolean) as { type: string; index: number; length: number; content: string }[];

    if (matches.length === 0) {
      tokens.push(<span key={key++}>{remaining}</span>);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];

    if (first.index > 0) {
      tokens.push(<span key={key++}>{remaining.slice(0, first.index)}</span>);
    }

    if (first.type === 'code') {
      tokens.push(
        <code key={key++} className="note-inline-code">
          {first.content}
        </code>
      );
    } else if (first.type === 'bold') {
      tokens.push(<strong key={key++}>{first.content}</strong>);
    } else if (first.type === 'strike') {
      tokens.push(<del key={key++}>{first.content}</del>);
    } else if (first.type === 'italic') {
      tokens.push(<em key={key++}>{first.content}</em>);
    }

    remaining = remaining.slice(first.index + first.length);
  }

  return tokens.length === 1 ? tokens[0] : <>{tokens}</>;
}

/**
 * Render multi-line formatted note containing headers, lists, quotes, and inline tokens.
 */
export function renderFormattedNote(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');

  return (
    <div className="formatted-note-container">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="note-empty-line" style={{ height: '6px' }} />;
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="note-h4" style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: 600 }}>
              {renderInlineMarkdown(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="note-h3" style={{ margin: '10px 0 4px', fontSize: '15px', fontWeight: 600 }}>
              {renderInlineMarkdown(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="note-h2" style={{ margin: '12px 0 6px', fontSize: '16px', fontWeight: 700 }}>
              {renderInlineMarkdown(trimmed.slice(2))}
            </h2>
          );
        }
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={idx} className="note-list-item" style={{ display: 'flex', gap: '8px', marginLeft: '6px', margin: '3px 0' }}>
              <span className="bullet-dot" style={{ color: 'var(--color-primary)', fontWeight: 'bold' }}>•</span>
              <div style={{ flex: 1 }}>{renderInlineMarkdown(trimmed.slice(2))}</div>
            </div>
          );
        }
        if (/^\d+\.\s/.test(trimmed)) {
          const match = trimmed.match(/^(\d+\.)\s(.*)$/);
          return (
            <div key={idx} className="note-list-item" style={{ display: 'flex', gap: '8px', marginLeft: '6px', margin: '3px 0' }}>
              <span className="bullet-num" style={{ color: 'var(--color-muted)', fontWeight: 600, minWidth: '18px' }}>
                {match ? match[1] : ''}
              </span>
              <div style={{ flex: 1 }}>{renderInlineMarkdown(match ? match[2] : trimmed)}</div>
            </div>
          );
        }
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="note-blockquote"
              style={{
                borderLeft: '3px solid var(--color-primary)',
                paddingLeft: '10px',
                margin: '6px 0',
                color: 'var(--color-muted)',
                fontStyle: 'italic'
              }}
            >
              {renderInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          );
        }
        return (
          <p key={idx} className="note-p" style={{ margin: '3px 0', lineHeight: 1.5 }}>
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Apply inline wrapping formatting (bold, italic, strikethrough, code)
 */
export function applyInlineFormatting(
  content: string,
  start: number,
  end: number,
  prefix: string,
  suffix = prefix,
  placeholder = 'text'
): { newContent: string; newCursorStart: number; newCursorEnd: number } {
  const selected = content.substring(start, end);

  if (selected) {
    const insertion = `${prefix}${selected}${suffix}`;
    const newContent = content.substring(0, start) + insertion + content.substring(end);
    const newPos = start + prefix.length + selected.length + suffix.length;
    return { newContent, newCursorStart: newPos, newCursorEnd: newPos };
  } else {
    const insertion = `${prefix}${placeholder}${suffix}`;
    const newContent = content.substring(0, start) + insertion + content.substring(end);
    const newCursorStart = start + prefix.length;
    const newCursorEnd = start + prefix.length + placeholder.length;
    return { newContent, newCursorStart, newCursorEnd };
  }
}

/**
 * Apply list formatting across single or multi-line selections.
 */
export function applyListFormatting(
  content: string,
  start: number,
  end: number,
  type: 'bullet' | 'number' | 'quote'
): { newContent: string; newCursorStart: number; newCursorEnd: number } {
  // Find start and end of affected lines
  const lineStartIndex = content.lastIndexOf('\n', start - 1) + 1;
  let lineEndIndex = content.indexOf('\n', end);
  if (lineEndIndex === -1) {
    lineEndIndex = content.length;
  }

  const affectedText = content.substring(lineStartIndex, lineEndIndex);
  const lines = affectedText.split('\n');

  let transformedLines: string[] = [];

  if (type === 'bullet') {
    const allAreBullets = lines.length > 0 && lines.every((l) => /^\s*[-*]\s+/.test(l));
    if (allAreBullets) {
      // Toggle off
      transformedLines = lines.map((l) => l.replace(/^\s*[-*]\s+/, ''));
    } else {
      // Toggle on for each line
      transformedLines = lines.map((l) => {
        if (/^\s*[-*]\s+/.test(l)) return l;
        if (/^\s*\d+\.\s+/.test(l)) return l.replace(/^\s*\d+\.\s+/, '- ');
        return `- ${l}`;
      });
    }
  } else if (type === 'number') {
    const allAreNumbered = lines.length > 0 && lines.every((l) => /^\s*\d+\.\s+/.test(l));
    if (allAreNumbered) {
      // Toggle off
      transformedLines = lines.map((l) => l.replace(/^\s*\d+\.\s+/, ''));
    } else {
      // Toggle on with incrementing numbers
      let num = 1;
      transformedLines = lines.map((l) => {
        const cleaned = l.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+\.\s+/, '');
        return `${num++}. ${cleaned}`;
      });
    }
  } else if (type === 'quote') {
    const allAreQuotes = lines.length > 0 && lines.every((l) => /^\s*>\s+/.test(l));
    if (allAreQuotes) {
      transformedLines = lines.map((l) => l.replace(/^\s*>\s+/, ''));
    } else {
      transformedLines = lines.map((l) => (/^\s*>\s+/.test(l) ? l : `> ${l}`));
    }
  }

  const newAffectedText = transformedLines.join('\n');
  const newContent = content.substring(0, lineStartIndex) + newAffectedText + content.substring(lineEndIndex);
  const newCursorEnd = lineStartIndex + newAffectedText.length;

  return {
    newContent,
    newCursorStart: lineStartIndex,
    newCursorEnd
  };
}

/**
 * Handle Enter key in Markdown textareas for smart list continuation
 */
export function handleListEnterKey(
  content: string,
  cursorPos: number
): { newContent: string; newCursorPos: number } | null {
  const beforeCursor = content.substring(0, cursorPos);
  const afterCursor = content.substring(cursorPos);
  const lastNewline = beforeCursor.lastIndexOf('\n');
  const currentLine = beforeCursor.substring(lastNewline + 1);

  // 1. Bullet list (- or *)
  const bulletMatch = currentLine.match(/^(\s*[-*]\s+)(.*)$/);
  if (bulletMatch) {
    const bulletPrefix = bulletMatch[1];
    const itemContent = bulletMatch[2];

    if (itemContent.trim().length === 0) {
      // Empty bullet -> exit list
      const cleanLineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const newContent = content.substring(0, cleanLineStart) + '\n' + afterCursor;
      return { newContent, newCursorPos: cleanLineStart + 1 };
    } else {
      // Continue bullet list
      const insertion = `\n${bulletPrefix}`;
      const newContent = beforeCursor + insertion + afterCursor;
      return { newContent, newCursorPos: cursorPos + insertion.length };
    }
  }

  // 2. Numbered list (1. , 2. )
  const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.*)$/);
  if (numberMatch) {
    const indent = numberMatch[1];
    const currentNum = parseInt(numberMatch[2], 10);
    const itemContent = numberMatch[3];

    if (itemContent.trim().length === 0) {
      // Empty number -> exit list
      const cleanLineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const newContent = content.substring(0, cleanLineStart) + '\n' + afterCursor;
      return { newContent, newCursorPos: cleanLineStart + 1 };
    } else {
      // Continue numbered list with next number
      const nextNum = currentNum + 1;
      const insertion = `\n${indent}${nextNum}. `;
      const newContent = beforeCursor + insertion + afterCursor;
      return { newContent, newCursorPos: cursorPos + insertion.length };
    }
  }

  // 3. Blockquote (> )
  const quoteMatch = currentLine.match(/^(\s*>\s+)(.*)$/);
  if (quoteMatch) {
    const quotePrefix = quoteMatch[1];
    const itemContent = quoteMatch[2];

    if (itemContent.trim().length === 0) {
      // Empty quote -> exit quote
      const cleanLineStart = lastNewline === -1 ? 0 : lastNewline + 1;
      const newContent = content.substring(0, cleanLineStart) + '\n' + afterCursor;
      return { newContent, newCursorPos: cleanLineStart + 1 };
    } else {
      const insertion = `\n${quotePrefix}`;
      const newContent = beforeCursor + insertion + afterCursor;
      return { newContent, newCursorPos: cursorPos + insertion.length };
    }
  }

  return null;
}
