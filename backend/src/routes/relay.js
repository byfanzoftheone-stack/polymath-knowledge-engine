const express = require('express');
const crypto = require('node:crypto');
const { query } = require('../db');
const { enqueue } = require('../queue/commandQueue');
const { emit } = require('../realtime/eventBus');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { sessionId, command } = req.body || {};

  if (!sessionId || !command) {
    return res.status(400).json({ ok: false, error: 'sessionId and command are required' });
  }

  const job = {
    id: crypto.randomUUID(),
    sessionId,
    command,
    status: 'queued'
  };

  try {
    await query(
      'INSERT INTO relay_jobs (id, session_id, command, status) VALUES ($1, $2, $3, $4)',
      [job.id, job.sessionId, job.command, job.status]
    );

    enqueue(job);

    const eventPayload = { type: 'relay.job.queued', jobId: job.id, command: job.command };
    emit(job.sessionId, eventPayload);
    await query(
      'INSERT INTO relay_events (session_id, job_id, event_type, payload) VALUES ($1, $2, $3, $4)',
      [job.sessionId, job.id, eventPayload.type, JSON.stringify(eventPayload)]
    );

    return res.status(202).json({ ok: true, job });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
