import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import Database from 'better-sqlite3';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import https from "node:https";
import http from "node:http";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize R2 Client
const r2Client = process.env.R2_ACCESS_KEY_ID ? new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
}) : null;

// Initialize SQLite for usage and history tracking
const db = new Database('app_data.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS guest_usage (
    ip TEXT PRIMARY KEY,
    count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS user_profiles (
    uid TEXT PRIMARY KEY,
    email TEXT,
    displayName TEXT,
    photoURL TEXT,
    role TEXT DEFAULT 'user',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS render_history (
    id TEXT PRIMARY KEY,
    userId TEXT,
    imageUrl TEXT,
    prompt TEXT,
    tier TEXT,
    location TEXT,
    city TEXT,
    isVerified INTEGER DEFAULT 0,
    label TEXT,
    sampleType TEXT DEFAULT 'render',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS daily_usage (
    userId TEXT,
    date TEXT,
    count INTEGER DEFAULT 0,
    PRIMARY KEY (userId, date)
  );

  CREATE TABLE IF NOT EXISTS bom_materials (
    id TEXT PRIMARY KEY,
    category TEXT,
    partNumber TEXT,
    name TEXT,
    unit TEXT,
    price REAL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS countries_logistics (
    id TEXT PRIMARY KEY,
    name TEXT,
    multiplier REAL,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Refresh Clean State - Only run once or when requested (Commented out after initial cleanup)
/*
try {
  db.prepare('DELETE FROM render_history').run();
  db.prepare('DELETE FROM bom_materials').run();
  console.log('Cleared render_history and bom_materials for fresh start.');
} catch (e) {
  console.error('Error during cleanup:', e);
}
*/

// Seed initial countries data if empty
const countryCount = db.prepare('SELECT COUNT(*) as count FROM countries_logistics').get() as { count: number };
if (countryCount.count === 0) {
  const initialCountries = [
    { id: 'ng', name: 'Nigeria', multiplier: 1.3 },
    { id: 'ke', name: 'Kenya', multiplier: 1.5 },
    { id: 'pk', name: 'Pakistan', multiplier: 2.0 },
  ];
  const insert = db.prepare('INSERT INTO countries_logistics (id, name, multiplier) VALUES (?, ?, ?)');
  for (const c of initialCountries) {
    insert.run(c.id, c.name, c.multiplier);
  }
}

// One-time migration: Convert existing Naira prices to USD if needed
const highPrices = db.prepare('SELECT COUNT(*) as count FROM bom_materials WHERE price > 1000').get() as { count: number };
if (highPrices.count > 0) {
  db.prepare('UPDATE bom_materials SET price = ROUND(price / 1500, 2) WHERE price > 1000').run();
  console.log('Migrated BOM prices from NGN to USD');
}

// Standard library managed via R2 Sync
const verifiedCount = db.prepare('SELECT COUNT(*) as count FROM render_history WHERE isVerified = 1').get() as { count: number };
console.log(`[Database] Current verified examples: ${verifiedCount.count}`);

// Cleanup old system-seeded examples if any exist
db.prepare("DELETE FROM render_history WHERE userId = 'system'").run();
console.log('[Standard Library] Cleaned up system seeded examples.');

app.use(express.json({ limit: '50mb' }));

// Global System Config (Brand Standards)
app.get("/api/config/:key", (req, res) => {
  const { key } = req.params;
  try {
    const row = db.prepare('SELECT value FROM system_config WHERE key = ?').get(key) as { value: string } | undefined;
    if (row) {
      res.json(JSON.parse(row.value));
    } else {
      res.status(404).json({ error: 'Config not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post("/api/config/:key", (req, res) => {
  const { key } = req.params;
  try {
    const value = JSON.stringify(req.body);
    db.prepare('INSERT OR REPLACE INTO system_config (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)').run(key, value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// API for BOM Materials
app.get("/api/bom/materials", (req, res) => {
  const rows = db.prepare('SELECT * FROM bom_materials ORDER BY category, name').all();
  res.json(rows);
});

app.post("/api/bom/materials/update", (req, res) => {
  const { id, category, partNumber, name, unit, price, userId } = req.body;
  
  // Check if user is admin
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt:', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  db.prepare(`
    UPDATE bom_materials 
    SET category = ?, partNumber = ?, name = ?, unit = ?, price = ?, updatedAt = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(category, partNumber, name, unit, price, id);
  res.json({ success: true });
});

app.post("/api/bom/materials/add", (req, res) => {
  const { category, partNumber, name, unit, price, userId } = req.body;
  
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt (add material):', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO bom_materials (id, category, partNumber, name, unit, price)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, category, partNumber, name, unit, price);
  res.json({ success: true, id });
});

app.post("/api/bom/materials/delete", (req, res) => {
  const { id, userId } = req.body;
  
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt (delete material):', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  const result = db.prepare('DELETE FROM bom_materials WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Material ID not found in database." });
  }
  res.json({ success: true });
});

// API for Countries Logistics
app.get("/api/countries/logistics", (req, res) => {
  const rows = db.prepare('SELECT * FROM countries_logistics ORDER BY name').all();
  res.json(rows);
});

app.post("/api/countries/logistics/add", (req, res) => {
  const { name, multiplier, userId } = req.body;
  
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt (add country):', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO countries_logistics (id, name, multiplier) VALUES (?, ?, ?)').run(id, name, multiplier);
  res.json({ success: true, id });
});

app.post("/api/countries/logistics/update", (req, res) => {
  const { id, name, multiplier, userId } = req.body;
  
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt (update country):', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  db.prepare('UPDATE countries_logistics SET name = ?, multiplier = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(name, multiplier, id);
  res.json({ success: true });
});

app.post("/api/countries/logistics/delete", (req, res) => {
  const { id, userId } = req.body;
  
  const user = db.prepare('SELECT role FROM user_profiles WHERE uid = ?').get(userId) as { role: string } | undefined;
  if (!user || user.role !== 'admin') {
    console.log('Unauthorized access attempt (delete country):', userId, 'User found:', !!user, 'Role:', user?.role);
    return res.status(403).json({ error: "Unauthorized. Admin access required." });
  }

  db.prepare('DELETE FROM countries_logistics WHERE id = ?').run(id);
  res.json({ success: true });
});

// API for R2 Status Check
app.get("/api/r2-status", (req, res) => {
  res.json({
    configured: !!r2Client,
    hasAccessKey: !!process.env.R2_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.R2_SECRET_ACCESS_KEY,
    hasEndpoint: !!process.env.R2_ENDPOINT,
    hasBucket: !!process.env.R2_BUCKET_NAME,
    hasPublicUrl: !!process.env.R2_PUBLIC_URL,
    endpoint: process.env.R2_ENDPOINT ? "Present" : "Missing",
    bucket: process.env.R2_BUCKET_NAME || "Missing"
  });
});

// API to sync Standard Library from R2
app.get("/api/sync-standard-library", async (req, res) => {
  if (!r2Client) return res.status(530).json({ error: "R2 not configured" });

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      Prefix: 'sync-standard-library/',
    });

    const response = await r2Client.send(listCommand);
    const objects = response.Contents || [];
    const publicBaseUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

    // Logic: If user wants a clean sync, we should remove items that are NOT in R2 but marked as verified
    // Or just clear all system/seeded verified items first.
    // For now, let's clear ALL verified items that are NOT from R2 and then re-add R2 items.
    // This ensures orphans are removed.
    db.prepare('DELETE FROM render_history WHERE isVerified = 1').run();
    console.log('[R2 Sync] Cleared old verified library entries for fresh sync');

    let addedCount = 0;
    const insert = db.prepare(`
      INSERT OR IGNORE INTO render_history (id, userId, imageUrl, prompt, tier, location, isVerified, label, sampleType)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const obj of objects) {
      if (!obj.Key || obj.Key.endsWith('/')) continue; // Skip folders
      const imageUrl = `${publicBaseUrl}/${obj.Key}`;
      
      const id = crypto.randomUUID();
      insert.run(
        id, 
        'system_sync', 
        imageUrl, 
        `Standard Reference from R2 Sync (${obj.Key})`, 
        'L3', 
        'Global', 
        1, 
        'R2 Sync Sample', 
        'render'
      );
      addedCount++;
    }

    res.json({ success: true, totalInR2: addedCount, addedToDb: addedCount });
  } catch (error) {
    console.error("R2 Sync Error:", error);
    res.status(500).json({ error: "Failed to sync with R2." });
  }
});

// Helper to get the most up-to-date Gemini Client
function getGenAI() {
  const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "").trim().replace(/^["']|["']$/g, '');
  
  const placeholders = [
    "undefined", 
    "null", 
    "MY_GEMINI_API_KEY", 
    "YOUR_API_KEY", 
    "PASTE_YOUR_API_KEY_HERE",
    "API_KEY",
    ""
  ];

  if (!geminiApiKey || placeholders.includes(geminiApiKey)) {
    return null;
  }
  return new GoogleGenAI({ apiKey: geminiApiKey });
}

// API for Proxying Gemini Calls (More robust for shared apps)
app.post("/api/proxy-generate", async (req, res) => {
  const ai = getGenAI();
  if (!ai) {
    return res.status(503).json({ 
      error: "Gemini API Key is missing or invalid (current value is a placeholder).",
      instructions: "Please go to AI Studio 'Settings' -> 'Environment Variables' and set GEMINI_API_KEY to your valid Google AI API key. Ensure no extra spaces or quotes are included."
    });
  }

  try {
    const { model, contents, config } = req.body;
    
    // Mask key for logging (only first/last 4 chars)
    const rawKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || "");
    const maskedKey = rawKey.length > 8 
      ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
      : "****";
    
    console.log(`[Gemini Proxy] Calling ${model} with key ${maskedKey}`);
    
    // In @google/genai, the method is ai.models.generateContent
    const result = await (ai as any).models.generateContent({
      model,
      contents,
      config
    });

    res.json(result);
  } catch (error: any) {
    console.error("[Gemini Proxy Error]", error);
    
    // Attempt to extract more detailed error info for better debugging
    const errorDetail = error.response?.data?.error || error.message;
    
    // Handle specific API key invalid error with better message
    if (error.message?.includes("API key not valid") || error.status === "INVALID_ARGUMENT" || error.code === 401) {
      return res.status(401).json({
        error: "The provided API Key is invalid. Please check your GEMINI_API_KEY in AI Studio Settings.",
        detail: errorDetail,
        status: "UNAUTHORIZED",
        code: 401
      });
    }

    res.status(500).json({ 
      error: error.message || "Internal Server Error",
      detail: errorDetail,
      status: error.status,
      code: error.code
    });
  }
});

// API for logging client-side errors
app.post("/api/log-error", (req, res) => {
  console.error("[Client Error]", req.body);
  res.json({ success: true });
});

// Helper for robust HTTP/HTTPS requests with User-Agent and Redirect handling
function fetchWithNodeHttp(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === "https:" ? https : http;
      
      const request = protocol.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "image/*, */*"
        }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          resolve(fetchWithNodeHttp(new URL(res.headers.location, url).toString()));
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`Server returned status code ${res.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers["content-type"] || "image/png"
          });
        });
      });

      request.on("error", (err) => reject(err));
      request.on("timeout", () => {
        request.destroy();
        reject(new Error("Request timeout"));
      });
    } catch (err) {
      reject(err);
    }
  });
}

// API for Proxying Remote Images (to bypass CORS)
app.get("/api/proxy-image", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    // Attempt standard fetch first (fastest, keeps headers)
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get("content-type") || "image/png";
        const base64 = Buffer.from(buffer).toString("base64");
        return res.json({ data: `data:${contentType};base64,${base64}` });
      }
    } catch (e) {
      console.warn("[proxy-image] Standard fetch failed, trying Node http/https fallback:", e);
    }

    // Fallback to manual HTTP/HTTPS module request to bypass Undici/Fetch connection drop issues
    const { buffer, contentType } = await fetchWithNodeHttp(url);
    const base64 = buffer.toString("base64");
    res.json({ data: `data:${contentType};base64,${base64}` });
  } catch (error: any) {
    console.error("[Image Proxy Error]", error);
    res.status(500).json({ error: error.message });
  }
});

// API for Config Check
app.get("/api/config", (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const hasKey = !!apiKey && apiKey !== "undefined" && apiKey !== "" && apiKey !== "null";
  
  console.log('[API Config Check]', {
    hasKey,
    keyLength: apiKey?.length || 0,
    nodeEnv: process.env.NODE_ENV
  });

  res.json({
    hasGeminiKey: hasKey,
    apiKey: hasKey ? apiKey : null,
    isProduction: process.env.NODE_ENV === "production"
  });
});

// API for R2 Upload
app.post("/api/upload", async (req, res) => {
  if (!r2Client) {
    return res.status(530).json({ error: "R2 storage not configured." });
  }

  try {
    const { image, folder = 'renders' } = req.body;
    if (!image) return res.status(400).json({ error: "No image data provided." });

    // Extract base64 data
    const matches = image.match(/^data:(.+);base64,(.*)$/);
    if (!matches) return res.status(400).json({ error: "Invalid image format." });

    const contentType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Generate unique filename
    const fileHash = crypto.randomBytes(16).toString('hex');
    const extension = contentType.split('/')[1] || 'png';
    const fileName = `${folder}/${fileHash}.${extension}`;

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    }));

    const publicBaseUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
    const publicUrl = `${publicBaseUrl}/${fileName}`;
    console.log(`[R2] Uploaded: ${fileName} -> ${publicUrl}`);
    res.json({ url: publicUrl });
  } catch (error) {
    console.error("R2 Upload Error:", error);
    res.status(500).json({ error: "Failed to upload to R2." });
  }
});

// API for user profiles
app.get("/api/user/profile/:uid", (req, res) => {
  const { uid } = req.params;
  const row = db.prepare('SELECT * FROM user_profiles WHERE uid = ?').get(uid);
  res.json(row || null);
});

app.post("/api/user/profile", (req, res) => {
  const { uid, email, displayName, photoURL } = req.body;
  const role = email.toLowerCase() === 'visgnlab@gmail.com' ? 'admin' : 'user';
  
  const existing = db.prepare('SELECT uid FROM user_profiles WHERE uid = ?').get(uid);
  if (existing) {
    db.prepare('UPDATE user_profiles SET email = ?, displayName = ?, photoURL = ?, role = ? WHERE uid = ?')
      .run(email, displayName, photoURL, role, uid);
  } else {
    db.prepare('INSERT INTO user_profiles (uid, email, displayName, photoURL, role) VALUES (?, ?, ?, ?, ?)')
      .run(uid, email, displayName, photoURL, role);
  }
  const updated = db.prepare('SELECT * FROM user_profiles WHERE uid = ?').get(uid);
  res.json(updated);
});

// API for user usage
app.get("/api/user/usage/:uid", (req, res) => {
  const { uid } = req.params;
  const date = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT count FROM daily_usage WHERE userId = ? AND date = ?').get(uid, date) as { count: number } | undefined;
  res.json({ count: row ? row.count : 0 });
});

app.post("/api/user/usage/increment/:uid", (req, res) => {
  const { uid } = req.params;
  const date = new Date().toISOString().split('T')[0];
  const row = db.prepare('SELECT count FROM daily_usage WHERE userId = ? AND date = ?').get(uid, date) as { count: number } | undefined;
  
  if (row) {
    db.prepare('UPDATE daily_usage SET count = count + 1 WHERE userId = ? AND date = ?').run(uid, date);
  } else {
    db.prepare('INSERT INTO daily_usage (userId, date, count) VALUES (?, ?, 1)').run(uid, date);
  }
  res.json({ success: true });
});

// API for render history
app.get("/api/history/:uid", (req, res) => {
  const { uid } = req.params;
  const limit = parseInt(req.query.limit as string) || 10;
  const rows = db.prepare('SELECT * FROM render_history WHERE userId = ? ORDER BY createdAt DESC LIMIT ?').all(uid, limit);
  // Convert isVerified back to boolean
  const history = rows.map((row: any) => ({
    ...row,
    isVerified: !!row.isVerified,
    createdAt: { toDate: () => new Date(row.createdAt) } // Mock Firestore timestamp
  }));
  res.json(history);
});

app.post("/api/history", (req, res) => {
  const { userId, imageUrl, prompt, tier, location, city, isVerified, label, sampleType } = req.body;
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO render_history (id, userId, imageUrl, prompt, tier, location, city, isVerified, label, sampleType)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, imageUrl, prompt, tier, location, city, isVerified ? 1 : 0, label || null, sampleType || 'render');
  res.json({ id });
});

app.get("/api/verified-examples", (req, res) => {
  const rows = db.prepare('SELECT * FROM render_history WHERE isVerified = 1 ORDER BY createdAt DESC LIMIT 20').all();
  const examples = rows.map((row: any) => ({
    ...row,
    isVerified: !!row.isVerified,
    createdAt: { toDate: () => new Date(row.createdAt) }
  }));
  res.json(examples);
});

app.post("/api/verify-render", (req, res) => {
  const { id, isVerified, label } = req.body;
  db.prepare('UPDATE render_history SET isVerified = ?, label = ? WHERE id = ?')
    .run(isVerified ? 1 : 0, label, id);
  res.json({ success: true });
});

// API for guest usage
app.get("/api/guest/usage", (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const row = db.prepare('SELECT count FROM guest_usage WHERE ip = ?').get(ip) as { count: number } | undefined;
  res.json({ count: row ? row.count : 0, limit: 3 });
});

app.post("/api/guest/increment", (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const row = db.prepare('SELECT count FROM guest_usage WHERE ip = ?').get(ip) as { count: number } | undefined;
  
  if (row && row.count >= 3) {
    return res.status(403).json({ error: "Guest limit reached for this IP. Please sign in to continue rendering." });
  }

  if (row) {
    db.prepare('UPDATE guest_usage SET count = count + 1, last_updated = CURRENT_TIMESTAMP WHERE ip = ?').run(ip);
  } else {
    db.prepare('INSERT INTO guest_usage (ip, count) VALUES (?, 1)').run(ip);
  }
  
  const updatedRow = db.prepare('SELECT count FROM guest_usage WHERE ip = ?').get(ip) as { count: number };
  res.json({ count: updatedRow.count, limit: 3 });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.status || err.statusCode) {
    res.status(err.status || err.statusCode).json({ error: err.message, status: err.status || err.statusCode });
  } else {
    next(err);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
