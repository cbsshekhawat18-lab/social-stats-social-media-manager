// CRA convention: this file is auto-loaded before each test file.
// See https://create-react-app.dev/docs/running-tests/#initializing-test-environment
import '@testing-library/jest-dom';

// Quiet the React 18 act() warnings that fire from zustand's external store
// notifications when our tests assert state that was set outside a render.
// We assert on the store directly via `useAppStore.getState()` rather than
// rendering components, so the warnings are noise.
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) {
      return;
    }
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});
