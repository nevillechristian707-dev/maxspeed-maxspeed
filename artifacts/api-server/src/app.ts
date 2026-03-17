import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPg from "connect-pg-simple";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PgStore = connectPg(session);

const app: Express = express();
app.set('trust proxy', 1);

app.get("/api/ping", (req, res) => res.send("pong"));
app.get("/api/debug-db", (req, res) => {
  res.json({
    hasUrl: !!process.env.DATABASE_URL,
    urlLength: process.env.DATABASE_URL?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    dbStatus: "Checking logic...",
    availableKeys: Object.keys(process.env) // List keys to see if anything is there
  });
});

// Parse CORS_ORIGIN
const corsOrigin = [
  "https://maxspeed-maxspeed-api-server.vercel.app",
  "https://maxspeed-maxspeed.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ limit: "500mb", extended: true }));
app.use(cookieParser());

// Middleware Bypass Cookie (Untuk Vercel <-> Railway)
app.use((req, res, next) => {
  const sessionId = req.headers['x-session-id'] as string;
  if (sessionId && !req.headers.cookie) {
    // Inject cookie secara manual dari header jika browser memblokir cookie asli
    req.headers.cookie = `maxspeed.sid=s%3A${encodeURIComponent(sessionId)}`;
  }
  next();
});



const sessionConfig: any = {
  secret: process.env.SESSION_SECRET ?? "maxspeed-racing-shop-secret-2024",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  name: "maxspeed.sid",
  cookie: {
    secure: true, // Always true for Railway/Vercel HTTPS
    httpOnly: true,
    sameSite: "none" as const, // Required for cross-domain cookies
    maxAge: 24 * 60 * 60 * 1000,
  },
};

if (process.env.DATABASE_URL) {
  try {
    const sessionPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ...(process.env.DATABASE_URL?.includes("pooler.supabase.com")
        ? { ssl: { rejectUnauthorized: false } }
        : {}),
    });
    // Create session table if it doesn't exist (avoids connect-pg-simple's
    // createTableIfMissing which uses __dirname and breaks in ESM bundles)
    sessionPool.query(`
      CREATE TABLE IF NOT EXISTS "public"."session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "public"."session" ("expire");
    `).catch(e => console.error("Failed to create session table:", e));

    sessionConfig.store = new PgStore({
      pool: sessionPool,
      schemaName: 'public',
      tableName: 'session'
    });
  } catch (e) {
    console.error("Failed to init PgStore:", e);
  }
}

app.use(session(sessionConfig));

// Mount API router strictly under /api prefix
app.use("/api", router);

// Static files (frontend asset)
const frontendPath = process.env.NODE_ENV === "production"
  ? path.join(__dirname, "public")
  : path.resolve(__dirname, "../../racing-shop/dist/public");

app.use(express.static(frontendPath));

// Fallback for SPA (Handle direct navigation & refresh)
app.use((req, res, next) => {
  // Never serve index.html for API requests
  if (req.path.startsWith("/api")) {
    return next();
  }
  
  // Skip file requests (css, js, png, etc) that should have been handled by express.static
  if (req.path.includes(".")) {
    return next();
  }
  
  // For all other GET requests, serve index.html to allow client-side routing
  if (req.method === "GET") {
    return res.sendFile(path.join(frontendPath, "index.html"), (err) => {
      if (err) {
        console.error("SPA Fallback Error:", err);
        next();
      }
    });
  }
  
  next();
});

// Error handler for JSON parsing or other errors
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err.stack);
  return res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected error occurred"
  });
});

export default app;
