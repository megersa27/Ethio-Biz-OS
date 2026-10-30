import test from 'node:test';
import assert from 'node:assert/strict';

import { groupSalesByDay } from './salesHistory.js';

test('groups sales into relative day buckets', () => {
  const referenceDate = new Date('2025-02-12T12:00:00+03:00');

  const sales = [
    { _id: 'today-sale', createdAt: '2025-02-12T08:30:00+03:00' },
    { _id: 'yesterday-sale', createdAt: '2025-02-11T14:20:00+03:00' },
    { _id: 'this-week-sale', createdAt: '2025-02-07T09:00:00+03:00' },
    { _id: 'older-sale', createdAt: '2025-01-30T19:00:00+03:00' },
  ];

  const grouped = groupSalesByDay(sales, referenceDate);

  assert.deepEqual(
    grouped.map((group) => ({ key: group.key, count: group.sales.length })),
    [
      { key: 'today', count: 1 },
      { key: 'yesterday', count: 1 },
      { key: 'thisWeek', count: 1 },
      { key: 'older', count: 1 },
    ]
  );
});
