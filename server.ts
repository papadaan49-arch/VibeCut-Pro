import express from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Validation Schemas ---
const JoinSchema = z.object({
  type: z.literal('join'),
  roomId: z.string().min(1).max(50),
});

const FileMetaSchema = z.object({
  type: z.literal('file-meta'),
  name: z.string(),
  fileType: z.string(),
  size: z.number().positive(),
  id: z.string().optional(), // Client-generated ID for tracking
});

const FileChunkSchema = z.object({
  type: z.literal('file-chunk'),
  id: z.string().optional(),
  name: z.string(),
  fileType: z.string(),
  chunk: z.string(), // Base64
  index: z.number().nonnegative(),
  total: z.number().positive(),
});

const MessageSchema = z.union([
  JoinSchema,
  FileMetaSchema,
  FileChunkSchema,
  z.object({ type: z.literal('signal'), payload: z.any() }).passthrough(),
]);

// --- Bandwidth Limiter (8 Mbps = 1 MB/s) ---
const MAX_BYTES_PER_SECOND = 1000 * 1000; // 1 MB/s

class BandwidthLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<{ ws: WebSocket; data: string }>;
  private processing: boolean;

  constructor() {
    this.tokens = MAX_BYTES_PER_SECOND;
    this.lastRefill = Date.now();
    this.queue = [];
    this.processing = false;
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = (elapsed / 1000) * MAX_BYTES_PER_SECOND;
    
    if (newTokens > 0) {
      this.tokens = Math.min(MAX_BYTES_PER_SECOND, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  public enqueue(ws: WebSocket, data: string) {
    this.queue.push({ ws, data });
    if (!this.processing) {
      this.processQueue();
    }
  }

  private async processQueue() {
    this.processing = true;
    
    while (this.queue.length > 0) {
      this.refill();
      
      const nextItem = this.queue[0];
      const messageSize = Buffer.byteLength(nextItem.data);

      if (this.tokens >= messageSize) {
        // Send immediately
        const { ws, data } = this.queue.shift()!;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
        this.tokens -= messageSize;
      } else {
        // Wait until we have enough tokens
        const needed = messageSize - this.tokens;
        const waitTime = (needed / MAX_BYTES_PER_SECOND) * 1000;
        
        // Wait at least 10ms to avoid tight loops
        await new Promise(resolve => setTimeout(resolve, Math.max(10, waitTime)));
      }
    }
    
    this.processing = false;
  }
}

const limiter = new BandwidthLimiter();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket Server
  const wss = new WebSocketServer({ server });

  const rooms = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws) => {
    let currentRoom = '';

    ws.on('message', (message) => {
      try {
        const rawData = JSON.parse(message.toString());
        
        // 1. Data Validation
        const validation = MessageSchema.safeParse(rawData);
        
        if (!validation.success) {
          console.error('Invalid message format:', validation.error);
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid data format', details: validation.error }));
          return;
        }

        const data = validation.data;

        if (data.type === 'join') {
          const { roomId } = data;
          currentRoom = roomId;
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId)?.add(ws);
          
          // Notify others in room
          broadcastToRoom(roomId, ws, { type: 'user-joined', count: rooms.get(roomId)?.size });
          
          // Send success to sender
          ws.send(JSON.stringify({ type: 'joined', roomId, count: rooms.get(roomId)?.size }));
        } else {
          // Forward signal/data to others in the room via Bandwidth Limiter
          broadcastToRoom(currentRoom, ws, data);
        }
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    });

    ws.on('close', () => {
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom)?.delete(ws);
        broadcastToRoom(currentRoom, ws, { type: 'user-left', count: rooms.get(currentRoom)?.size });
        if (rooms.get(currentRoom)?.size === 0) {
          rooms.delete(currentRoom);
        }
      }
    });
  });

  function broadcastToRoom(roomId: string, sender: WebSocket, data: any) {
    const clients = rooms.get(roomId);
    if (clients) {
      const messageStr = JSON.stringify(data);
      clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
          // Use Limiter for data-heavy messages, or direct for small control messages?
          // For simplicity and strict adherence to 8Mbps, route everything through limiter.
          limiter.enqueue(client, messageStr);
        }
      });
    }
  }

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', connections: wss.clients.size });
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
