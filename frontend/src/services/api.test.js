import test from 'node:test';
import assert from 'node:assert/strict';

import { apiRequest } from './api.js';

test('apiRequest rejects with a clear backend unavailable message when it hangs', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, options) =>
    new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    });

  try {
    await assert.rejects(
      () => apiRequest('/auth/login', { method: 'POST', body: { identifier: 'a', password: 'b' } }, 50),
      {
        name: 'Error',
        message: 'The backend is not responding. Please make sure the backend server is running, then try again.',
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
