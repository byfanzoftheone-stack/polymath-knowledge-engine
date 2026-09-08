const express = require('express');
const { query } = require('../db');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const result = await query('SELECT id, slug, title, description, created_at, updated_at FROM lessons ORDER BY created_at ASC');
    res.json({ ok: true, lessons: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
