const queue = [];

function enqueue(job) {
  queue.push(job);
}

function dequeue() {
  return queue.shift() || null;
}

function size() {
  return queue.length;
}

module.exports = { enqueue, dequeue, size };
