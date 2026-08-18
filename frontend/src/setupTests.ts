import '@testing-library/jest-dom';

// Polyfill window.matchMedia for JSDOM in tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
});

// Polyfill document.execCommand for JSDOM in tests
if (typeof document !== 'undefined' && !document.execCommand) {
  document.execCommand = () => true;
}
