const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'arena.json');

// ── Simple JSON file database ────────────────────────────────
function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {}
  return { characters: [], battles: [] };
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ── One-time migration: nhân 3 HP cho nhân vật cũ (format trước khi HP range đổi thành 1650-3000) ──
function migrateHpX3() {
  const db = readDB();
  let changed = false;
  db.characters.forEach(c => {
    if (c.stats && typeof c.stats.hp === 'number' && c.stats.hp <= 1000) {
      c.stats.hp = c.stats.hp * 3;
      changed = true;
    }
  });
  if (changed) {
    writeDB(db);
    console.log(`✅ Migrated HP x3 for existing characters`);
  }
}
migrateHpX3();

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));
// Production: serve built frontend
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
}

// ── Characters ───────────────────────────────────────────────
app.get('/api/characters', (req, res) => {
  const db = readDB();
  res.json(db.characters);
});

app.post('/api/characters', (req, res) => {
  const db = readDB();
  const c = req.body;
  if (!c.id) return res.status(400).json({ error: 'id required' });
  db.characters.push(c);
  writeDB(db);
  res.json({ ok: true });
});

app.put('/api/characters/:id', (req, res) => {
  const db = readDB();
  const idx = db.characters.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    db.characters.push({ ...req.body, id: req.params.id });
  } else {
    db.characters[idx] = { ...req.body, id: req.params.id };
  }
  writeDB(db);
  res.json({ ok: true });
});

app.delete('/api/characters/:id', (req, res) => {
  const db = readDB();
  db.characters = db.characters.filter(c => c.id !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── Battle Logs ──────────────────────────────────────────────
app.post('/api/battles', (req, res) => {
  const db = readDB();
  db.battles.unshift({ ...req.body, created_at: new Date().toISOString() });
  if (db.battles.length > 100) db.battles = db.battles.slice(0, 100);
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/battles', (req, res) => {
  const db = readDB();
  res.json(db.battles.slice(0, 50));
});

// ── Fallback SPA (production only) ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`\n⚔️  Arena Battle server running at http://localhost:${PORT}`);
  console.log(`   Open your browser at http://localhost:${PORT}\n`);
});
