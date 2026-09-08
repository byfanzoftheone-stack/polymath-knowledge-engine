const express = require('express');
const crypto = require('node:crypto');
const { query } = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, lesson_id, status, created_at, updated_at FROM sessions ORDER BY created_at DESC');
    res.json({ ok: true, sessions: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const { lessonId = null } = req.body || {};

  try {
    const session = {
      id: crypto.randomUUID(),
      lessonId,
      status: 'active'
    };

    await query(
      'INSERT INTO sessions (id, lesson_id, status) VALUES ($1, $2, $3)',
      [session.id, session.lessonId, session.status]
    );

    res.status(201).json({ ok: true, session });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
