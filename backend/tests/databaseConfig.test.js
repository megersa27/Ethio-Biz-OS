const test = require('node:test');
const assert = require('node:assert/strict');

const { getMongoUri } = require('../src/config/database');

test('getMongoUri falls back to the local development database when no env value is supplied', () => {
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoUriAlt = process.env.MONGO_URI;

  delete process.env.MONGODB_URI;
  delete process.env.MONGO_URI;

  try {
    assert.equal(
      getMongoUri(),
      'mongodb://127.0.0.1:27017/ethioBiz?replicaSet=rs0'
    );
  } finally {
    if (previousMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previousMongoUri;
    }

    if (previousMongoUriAlt === undefined) {
      delete process.env.MONGO_URI;
    } else {
      process.env.MONGO_URI = previousMongoUriAlt;
    }
  }
});

test('connectDB falls back to the local database when a configured MongoDB URI is unreachable', async () => {
  const previousMongoUri = process.env.MONGODB_URI;
  const previousMongoUriAlt = process.env.MONGO_URI;
  const connectDB = require('../src/config/database');

  process.env.MONGODB_URI = 'mongodb://127.0.0.1:65535/ethioBiz';
  delete process.env.MONGO_URI;

  try {
    const { getMongoUri } = require('../src/config/database');

    assert.equal(getMongoUri(), 'mongodb://127.0.0.1:65535/ethioBiz');

    await connectDB();
    assert.ok(true);
  } finally {
    if (previousMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = previousMongoUri;
    }

    if (previousMongoUriAlt === undefined) {
      delete process.env.MONGO_URI;
    } else {
      process.env.MONGO_URI = previousMongoUriAlt;
    }
  }
});
