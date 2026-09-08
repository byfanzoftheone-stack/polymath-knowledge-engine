const test = require('node:test');
const assert = require('node:assert/strict');
const { enqueue, dequeue, size } = require('../src/queue/commandQueue');

test('command queue enqueues and dequeues in FIFO order', () => {
  enqueue({ id: '1' });
  enqueue({ id: '2' });

  assert.equal(size(), 2);
  assert.equal(dequeue().id, '1');
  assert.equal(dequeue().id, '2');
  assert.equal(dequeue(), null);
});
