const test = require('node:test');
const assert = require('node:assert/strict');

const { generateToken } = require('../src/utils/jwt');
const { registerBusiness } = require('../src/services/authService');

test('generateToken rejects users that are not linked to a business', () => {
  assert.throws(
    () => generateToken({ _id: { toString: () => 'user-123' }, role: 'OWNER' }),
    {
      name: 'Error',
      message: 'User account is missing business information',
    }
  );
});

test('registerBusiness enforces an 8-character password and 10-digit phone', async () => {
  await assert.rejects(
    () => registerBusiness({
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      email: 'validuser@example.com',
      phone: '091234567',
      password: '12345678',
    }),
    {
      name: 'Error',
      message: 'Phone number must be exactly 10 digits',
    }
  );

  await assert.rejects(
    () => registerBusiness({
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      email: 'validuser2@example.com',
      phone: '0912345678',
      password: '1234567',
    }),
    {
      name: 'Error',
      message: 'Password must be at least 8 characters',
    }
  );
});
