import '@testing-library/jest-dom';

// Mock ResizeObserver (not available in jsdom, required by recharts)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = () => {};
