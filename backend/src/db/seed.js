const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { query, pool } = require('./index');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function seedLessons() {
  const seedPath = path.resolve(__dirname, '../../../docs/starter-content/lessons.json');
  const lessons = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

  for (const lesson of lessons) {
    await query(
      `INSERT INTO lessons (id, slug, title, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
       SET slug = EXCLUDED.slug,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           updated_at = NOW()`,
      [lesson.id, lesson.slug, lesson.title, lesson.description]
    );
  }

  console.log(`Seeded ${lessons.length} lessons.`);
}

if (require.main === module) {
  seedLessons()
    .then(() => pool.end())
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { seedLessons };
