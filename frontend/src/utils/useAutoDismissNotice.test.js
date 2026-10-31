import test from 'node:test';
import assert from 'node:assert/strict';

import { scheduleAutoDismiss } from './useAutoDismissNotice.js';

test('clears a notice after the configured timeout', async () => {
  let currentMessage = 'Saved successfully';
  const setNotice = (nextMessage) => {
    currentMessage = nextMessage;
  };

  const clearTimer = scheduleAutoDismiss(setNotice, 'Saved successfully', 25);

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(currentMessage, '');

  clearTimer();
});
