import { useEffect, useRef } from 'react';

/**
 * Custom hook to register an Escape key dismissal listener on modals/drawers.
 * Reuses cleanly across all dialogs with ref-stabilized callbacks.
 */
export function useEscapeKey(onClose: () => void, isOpen: boolean = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);
}
