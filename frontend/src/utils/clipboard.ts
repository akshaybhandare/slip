/**
 * Robust cross-platform clipboard utility.
 * Supports modern Clipboard API with iOS Safari and standalone PWA (HTTP/HTTPS) fallback.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== 'string' || text.length === 0) {
    return false;
  }

  // 1. Attempt modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
    }
  }

  // 2. Fallback for iOS PWA, WebKit standalone, HTTP origins, or unsupported environments
  if (typeof document === 'undefined') {
    return false;
  }

  let textarea: HTMLTextAreaElement | null = null;
  const previouslyFocusedElement = document.activeElement as HTMLElement | null;

  try {
    textarea = document.createElement('textarea');
    textarea.value = text;

    // Prevent viewport zooming, visual disruption, and layout shift
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.fontSize = '16px'; // Prevents auto-zoom on iOS Safari
    textarea.setAttribute('readonly', '');
    textarea.style.opacity = '0';

    document.body.appendChild(textarea);

    const isIOS = typeof navigator !== 'undefined' && /ipad|iphone|ipod/i.test(navigator.userAgent || '');

    if (isIOS) {
      // iOS WebKit selection quirks in standalone PWA / Safari
      textarea.contentEditable = 'true';
      textarea.readOnly = false;

      const range = document.createRange();
      range.selectNodeContents(textarea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textarea.setSelectionRange(0, 999999);
    } else {
      textarea.focus();
      textarea.select();
    }

    const successful = document.execCommand('copy');
    return successful;
  } catch (err) {
    console.error('Fallback clipboard execution failed:', err);
    return false;
  } finally {
    if (window.getSelection()) {
      window.getSelection()?.removeAllRanges();
    }
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
    if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
      try {
        previouslyFocusedElement.focus();
      } catch {
        // Ignore focus restoration errors
      }
    }
  }
}
