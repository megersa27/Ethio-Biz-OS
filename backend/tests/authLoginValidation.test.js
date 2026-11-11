const test = require('node:test');
const assert = require('node:assert/strict');

const { generateToken } = require('../src/utils/jwt');

test('generateToken rejects users that are not linked to a business', () => {
  assert.throws(
    () => generateToken({ _id: { toString: () => 'user-123' }, role: 'OWNER' }),
    {
      name: 'Error',
      message: 'User account is missing business information',
    }
  );
});
