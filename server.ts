import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS trucks (
    id TEXT PRIMARY KEY,
    plate_number TEXT UNIQUE NOT NULL,
    driver_name TEXT NOT NULL,
    company TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    load_type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS gates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS queues (
    id TEXT PRIMARY KEY,
    truck_id TEXT NOT NULL,
    gate_id TEXT,
    priority TEXT DEFAULT 'normal',
    status TEXT DEFAULT 'waiting',
    entry_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    call_time DATETIME,
    process_time DATETIME,
    exit_time DATETIME,
    FOREIGN KEY (truck_id) REFERENCES trucks(id),
    FOREIGN KEY (gate_id) REFERENCES gates(id)
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Add new columns if they don't exist
try { db.exec("ALTER TABLE queues ADD COLUMN queue_type TEXT DEFAULT 'Normal Truck'"); } catch (e) {}
try { db.exec("ALTER TABLE queues ADD COLUMN round_number INTEGER DEFAULT 1"); } catch (e) {}
try { db.exec("ALTER TABLE queues ADD COLUMN senior_number INTEGER DEFAULT 1"); } catch (e) {}

// Seed initial data if empty
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  const insertUser = db.prepare('INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, ?)');
  insertUser.run(uuidv4(), 'admin', 'admin', 'admin');
  insertUser.run(uuidv4(), 'security', 'security', 'security');
  insertUser.run(uuidv4(), 'operator', 'operator', 'operator');
  insertUser.run(uuidv4(), 'viewer', 'viewer', 'viewer');

  const insertGate = db.prepare('INSERT INTO gates (id, name, type) VALUES (?, ?, ?)');
  insertGate.run(uuidv4(), 'Gate 1 (Entry)', 'entry');
  insertGate.run(uuidv4(), 'Gate 2 (Exit)', 'exit');
  insertGate.run(uuidv4(), 'Loading Dock A', 'loading');
  insertGate.run(uuidv4(), 'Loading Dock B', 'loading');

  const insertConfig = db.prepare('INSERT INTO config (key, value) VALUES (?, ?)');
  insertConfig.run('cane_types', JSON.stringify(['General', 'Hazardous', 'Fragile', 'Refrigerated']));
  insertConfig.run('priority_rules', JSON.stringify({ high_priority_types: ['Hazardous', 'Refrigerated'] }));
  insertConfig.run('current_round_number', '1');
} else {
  // Ensure current_round_number exists even if users exist
  const roundCount = db.prepare("SELECT COUNT(*) as count FROM config WHERE key = 'current_round_number'").get() as { count: number };
  if (roundCount.count === 0) {
    db.prepare("INSERT INTO config (key, value) VALUES ('current_round_number', '1')").run();
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // API Routes
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT id, username, role FROM users WHERE username = ? AND password = ?').get(username, password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  // Trucks
  app.get('/api/trucks', (req, res) => {
    const trucks = db.prepare('SELECT * FROM trucks ORDER BY created_at DESC').all();
    res.json(trucks);
  });

  app.post('/api/trucks', (req, res) => {
    const { plate_number, driver_name, company, vehicle_type, load_type } = req.body;
    try {
      const id = uuidv4();
      db.prepare(
        'INSERT INTO trucks (id, plate_number, driver_name, company, vehicle_type, load_type) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, plate_number, driver_name, company, vehicle_type, load_type);
      
      const newTruck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(id);
      res.json({ success: true, truck: newTruck });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post('/api/trucks/bulk', (req, res) => {
    const trucks = req.body.trucks;
    if (!Array.isArray(trucks)) {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }

    try {
      const insert = db.prepare(
        'INSERT INTO trucks (id, plate_number, driver_name, company, vehicle_type, load_type) VALUES (?, ?, ?, ?, ?, ?)'
      );
      
      const insertMany = db.transaction((trucksToInsert) => {
        const results = [];
        for (const truck of trucksToInsert) {
          const id = uuidv4();
          insert.run(id, truck.plate_number, truck.driver_name || '', truck.company || '', truck.vehicle_type || 'Trailer', truck.load_type || 'General');
          results.push({ id, ...truck });
        }
        return results;
      });

      const newTrucks = insertMany(trucks);
      res.json({ success: true, trucks: newTrucks, count: newTrucks.length });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.get('/api/trucks/:id', (req, res) => {
    const truck = db.prepare('SELECT * FROM trucks WHERE id = ?').get(req.params.id);
    if (truck) {
      res.json(truck);
    } else {
      res.status(404).json({ message: 'Truck not found' });
    }
  });

  // Queues
  app.get('/api/queues', (req, res) => {
    const queues = db.prepare(`
      SELECT q.*, t.plate_number, t.driver_name, t.company, t.vehicle_type, t.load_type, g.name as gate_name
      FROM queues q
      JOIN trucks t ON q.truck_id = t.id
      LEFT JOIN gates g ON q.gate_id = g.id
      WHERE q.status != 'completed' OR (q.status = 'completed' AND date(q.exit_time) = date('now'))
      ORDER BY 
        CASE q.priority WHEN 'vip' THEN 1 ELSE 2 END,
        q.entry_time ASC
    `).all();
    res.json(queues);
  });

  app.post('/api/queues/entry', (req, res) => {
    const { truck_id, priority = 'normal', queue_type = 'Normal Truck' } = req.body;
    
    // Check if truck is blacklisted
    const truck = db.prepare('SELECT status FROM trucks WHERE id = ?').get(truck_id) as { status: string };
    if (!truck) {
      return res.status(404).json({ success: false, message: 'Truck not found' });
    }
    if (truck.status === 'blacklisted') {
      return res.status(403).json({ success: false, message: 'Truck is blacklisted' });
    }

    // Get current round number
    const roundConfig = db.prepare("SELECT value FROM config WHERE key = 'current_round_number'").get() as { value: string };
    const currentRoundNumber = parseInt(roundConfig?.value || '1', 10);

    // Check if already in active queue
    const activeQueue = db.prepare('SELECT id FROM queues WHERE truck_id = ? AND status != ?').get(truck_id, 'completed');
    if (activeQueue) {
      return res.status(400).json({ success: false, message: 'Truck is already in the queue' });
    }
    
    // Check if already entered in this round
    const roundEntry = db.prepare('SELECT id FROM queues WHERE truck_id = ? AND round_number = ?').get(truck_id, currentRoundNumber);
    if (roundEntry) {
      return res.status(400).json({ success: false, message: `Truck has already entered in Round ${currentRoundNumber}` });
    }

    try {
      // Calculate senior number for this queue_type in this round
      const maxSeniorResult = db.prepare('SELECT MAX(senior_number) as max_senior FROM queues WHERE round_number = ? AND queue_type = ?').get(currentRoundNumber, queue_type) as { max_senior: number | null };
      const seniorNumber = (maxSeniorResult.max_senior || 0) + 1;

      const id = uuidv4();
      db.prepare(
        'INSERT INTO queues (id, truck_id, priority, status, queue_type, round_number, senior_number) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, truck_id, priority, 'waiting', queue_type, currentRoundNumber, seniorNumber);
      
      io.emit('queue_updated');
      res.json({ success: true, queue_id: id, round_number: currentRoundNumber, senior_number: seniorNumber });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.put('/api/queues/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, gate_id } = req.body;

    let updateQuery = 'UPDATE queues SET status = ?';
    const params: any[] = [status];

    if (status === 'called') {
      updateQuery += ', call_time = CURRENT_TIMESTAMP, gate_id = ?';
      params.push(gate_id);
    } else if (status === 'processing') {
      updateQuery += ', process_time = CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      updateQuery += ', exit_time = CURRENT_TIMESTAMP';
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    try {
      db.prepare(updateQuery).run(...params);
      io.emit('queue_updated');
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  app.post('/api/queues/exit', (req, res) => {
    const { truck_id } = req.body;
    
    const activeQueue = db.prepare('SELECT id FROM queues WHERE truck_id = ? AND status != ?').get(truck_id, 'completed') as { id: string };
    if (!activeQueue) {
      return res.status(404).json({ success: false, message: 'Truck not found in active queue' });
    }

    try {
      db.prepare('UPDATE queues SET status = ?, exit_time = CURRENT_TIMESTAMP WHERE id = ?').run('completed', activeQueue.id);
      io.emit('queue_updated');
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Gates
  app.get('/api/gates', (req, res) => {
    const gates = db.prepare('SELECT * FROM gates').all();
    res.json(gates);
  });

  // Stats
  app.get('/api/stats', (req, res) => {
    const totalToday = db.prepare("SELECT COUNT(*) as count FROM queues WHERE date(entry_time) = date('now')").get() as { count: number };
    const currentlyWaiting = db.prepare("SELECT COUNT(*) as count FROM queues WHERE status = 'waiting'").get() as { count: number };
    const currentlyProcessing = db.prepare("SELECT COUNT(*) as count FROM queues WHERE status = 'processing'").get() as { count: number };
    const completedToday = db.prepare("SELECT COUNT(*) as count FROM queues WHERE status = 'completed' AND date(exit_time) = date('now')").get() as { count: number };
    
    // Calculate average waiting time (in minutes) for today
    const avgWaitTimeResult = db.prepare(`
      SELECT AVG((julianday(call_time) - julianday(entry_time)) * 24 * 60) as avg_wait
      FROM queues 
      WHERE call_time IS NOT NULL AND date(entry_time) = date('now')
    `).get() as { avg_wait: number | null };

    res.json({
      totalToday: totalToday.count,
      currentlyWaiting: currentlyWaiting.count,
      currentlyProcessing: currentlyProcessing.count,
      completedToday: completedToday.count,
      avgWaitTime: Math.round(avgWaitTimeResult.avg_wait || 0)
    });
  });

  // Round Management
  app.get('/api/round', (req, res) => {
    const roundConfig = db.prepare("SELECT value FROM config WHERE key = 'current_round_number'").get() as { value: string };
    res.json({ current_round_number: parseInt(roundConfig?.value || '1', 10) });
  });

  app.post('/api/round/next', (req, res) => {
    try {
      const roundConfig = db.prepare("SELECT value FROM config WHERE key = 'current_round_number'").get() as { value: string };
      const currentRoundNumber = parseInt(roundConfig?.value || '1', 10);
      const nextRoundNumber = currentRoundNumber + 1;
      
      db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('current_round_number', ?)").run(nextRoundNumber.toString());
      
      io.emit('queue_updated'); // Trigger refresh
      res.json({ success: true, current_round_number: nextRoundNumber });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Config
  app.get('/api/config', (req, res) => {
    const configRecords = db.prepare('SELECT key, value FROM config').all() as { key: string, value: string }[];
    const config: Record<string, any> = {};
    for (const record of configRecords) {
      try {
        config[record.key] = JSON.parse(record.value);
      } catch (e) {
        config[record.key] = record.value;
      }
    }
    res.json(config);
  });

  app.post('/api/config', (req, res) => {
    const { cane_types, priority_rules } = req.body;
    try {
      const updateConfig = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
      updateConfig.run('cane_types', JSON.stringify(cane_types));
      updateConfig.run('priority_rules', JSON.stringify(priority_rules));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
