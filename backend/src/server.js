const http = require('node:http');
const dotenv = require('dotenv');
const path = require('node:path');

const { createApp } = require('./app');
const { createRelayWsServer } = require('./realtime/wsServer');
const { setBroadcaster } = require('./realtime/eventBus');
const { startWorkerLoop } = require('./workers/workerLoop');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = createApp();
const server = http.createServer(app);
const wsRelay = createRelayWsServer(server);
setBroadcaster(wsRelay.broadcast);

const port = Number(process.env.PORT || 3000);
const workerPollMs = Number(process.env.WORKER_POLL_MS || 1000);

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  startWorkerLoop(workerPollMs);
});
