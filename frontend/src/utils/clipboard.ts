/**
 * Robust cross-platform clipboard utility.
 * Supports modern Clipboard API (HTTPS) and bulletproof fallbacks for
 * iOS Safari, Standalone PWA, Android, and local network HTTP origins.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string' || text.length === 0) {
    return false;
  }

  // 1. Attempt modern Async Clipboard API (works on HTTPS / localhost / supported browsers)
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText rejected, attempting execCommand fallback:', err);
    }
  }

  // 2. Synchronous fallback for HTTP/LAN origins, iOS Safari, PWA, Android
  if (typeof document === 'undefined') {
    return false;
  }

  const previouslyFocusedElement = document.activeElement as HTMLElement | null;

  // Strategy A: Form control textarea with setSelectionRange inside viewport layout
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Must be positioned at top: 0, left: 0 inside the viewport for WebKit copy heuristics,
    // but completely invisible and transparent with no user layout disruption.
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.margin = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.zIndex = '-9999';
    textarea.style.fontSize = '16px'; // Prevents auto-zoom in iOS Safari
    textarea.setAttribute('readonly', '');

    document.body.appendChild(textarea);

    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    if (textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }

    if (successful) {
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        try {
          previouslyFocusedElement.focus();
        } catch {
          // Ignore focus errors
        }
      }
      return true;
    }
  } catch (err) {
    console.warn('Textarea execCommand copy failed, trying contenteditable fallback:', err);
  }

  // Strategy B: Contenteditable span with DOM Range selection (for WebKit strict layout policies)
  try {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.whiteSpace = 'pre';
    span.style.position = 'fixed';
    span.style.top = '0';
    span.style.left = '0';
    span.style.width = '1px';
    span.style.height = '1px';
    span.style.opacity = '0';
    span.style.pointerEvents = 'none';
    span.style.zIndex = '-9999';
    span.setAttribute('contenteditable', 'true');
    span.tabIndex = -1;

    document.body.appendChild(span);

    const range = document.createRange();
    range.selectNodeContents(span);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }

    const successful = document.execCommand('copy');

    if (selection) {
      selection.removeAllRanges();
    }
    if (span.parentNode) {
      span.parentNode.removeChild(span);
    }

    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      try {
        previouslyFocusedElement.focus();
      } catch {
        // Ignore focus errors
      }
    }

    return successful;
  } catch (err) {
    console.error('All copy to clipboard strategies failed:', err);
    return false;
  }
}
