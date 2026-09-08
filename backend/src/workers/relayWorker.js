const { query } = require('../db');
const { dequeue } = require('../queue/commandQueue');
const { emit } = require('../realtime/eventBus');

async function simulateCommand(command) {
  await new Promise((resolve) => setTimeout(resolve, 250));
  return { output: `Executed command: ${command}` };
}

async function processNext() {
  const job = dequeue();
  if (!job) {
    return null;
  }

  await query('UPDATE relay_jobs SET status = $1, started_at = NOW() WHERE id = $2', ['running', job.id]);
  emit(job.sessionId, { type: 'relay.job.started', jobId: job.id, command: job.command });

  try {
    const result = await simulateCommand(job.command);
    await query(
      'UPDATE relay_jobs SET status = $1, output = $2, finished_at = NOW() WHERE id = $3',
      ['completed', result.output, job.id]
    );

    const eventPayload = { type: 'relay.job.completed', jobId: job.id, output: result.output };
    emit(job.sessionId, eventPayload);
    await query(
      'INSERT INTO relay_events (session_id, job_id, event_type, payload) VALUES ($1, $2, $3, $4)',
      [job.sessionId, job.id, eventPayload.type, JSON.stringify(eventPayload)]
    );
  } catch (error) {
    await query(
      'UPDATE relay_jobs SET status = $1, error = $2, finished_at = NOW() WHERE id = $3',
      ['failed', error.message, job.id]
    );
    emit(job.sessionId, { type: 'relay.job.failed', jobId: job.id, error: error.message });
  }

  return job.id;
}

module.exports = { processNext };
