import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
  });

  // 1. API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 2. Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  app.use(vite.middlewares);

  // 3. Fallback for SPA
  app.get("*", async (req, res, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api')) return next();
    
    try {
      const indexPath = path.join(process.cwd(), "index.html");
      let template = fs.readFileSync(indexPath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      console.error(`[SERVER] Error:`, e);
      next(e);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SERVER] Dashboard is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[SERVER] Error starting server:", err);
});
