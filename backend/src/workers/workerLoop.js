const { processNext } = require('./relayWorker');

let timer = null;
let inFlight = false;

async function tick() {
  if (inFlight) {
    return;
  }
  inFlight = true;
  try {
    await processNext();
  } finally {
    inFlight = false;
  }
}

function startWorkerLoop(intervalMs = 1000) {
  if (timer) {
    return timer;
  }

  timer = setInterval(() => {
    tick().catch((error) => {
      console.error('Worker tick failed:', error.message);
    });
  }, intervalMs);

  return timer;
}

function stopWorkerLoop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startWorkerLoop, stopWorkerLoop };
