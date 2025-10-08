import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeTriage, chatWithAI } from "./gemini";
import { hashPassword, comparePassword, requireAuth, requireAdmin } from "./auth";
import { insertUserSchema, insertHealthLogSchema, insertAlertSchema } from "@shared/schema";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(1),
});

const updateAlertSchema = z.object({
  status: z.enum(["pending", "active", "resolved"]),
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const data = signupSchema.parse(req.body);
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const hashedPassword = await hashPassword(data.password);
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        name: data.name,
        role: "patient",
      });

      req.session.userId = user.id;
      req.session.userRole = user.role;

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await comparePassword(data.password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.userId = user.id;
      req.session.userRole = user.role;

      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Login error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }
      
      const { password, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ error: "Failed to get user" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.post("/api/triage", requireAuth, async (req, res) => {
    try {
      const data = z.object({ symptoms: z.string().min(1) }).parse(req.body);
      const userId = req.session.userId!;
      
      const triageResult = await analyzeTriage(data.symptoms);
      
      await storage.createAIChatLog({
        userId,
        prompt: data.symptoms,
        response: triageResult,
      });

      res.json(triageResult);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Triage error:", error);
      res.status(500).json({ error: "Triage analysis failed" });
    }
  });

  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const data = z.object({ message: z.string().min(1) }).parse(req.body);
      
      const response = await chatWithAI(data.message);
      
      res.json({ message: response });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Chat error:", error);
      res.status(500).json({ error: "Chat failed" });
    }
  });

  app.post("/api/alerts", requireAuth, async (req, res) => {
    try {
      const data = z.object({
        location: z.object({ lat: z.number(), lng: z.number() }),
        urgency: z.number().min(1).max(10),
        description: z.string().optional(),
      }).parse(req.body);
      
      const alert = await storage.createAlert({
        userId: req.session.userId!,
        location: data.location,
        urgency: data.urgency,
        description: data.description,
        status: "pending",
      });

      res.json(alert);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Alert creation error:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const userRole = req.session.userRole;
      const userId = req.session.userId!;
      
      const alerts = userRole === "admin"
        ? await storage.getAlerts()
        : await storage.getAlertsByUser(userId);
      
      res.json(alerts);
    } catch (error) {
      console.error("Get alerts error:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/alerts/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateAlertSchema.parse(req.body);
      
      const alert = await storage.updateAlertStatus(id, data.status);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json(alert);
    } catch (error) {
      console.error("Update alert error:", error);
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/health-logs", requireAuth, async (req, res) => {
    try {
      const data = insertHealthLogSchema.omit({ userId: true }).parse(req.body);
      const log = await storage.createHealthLog({
        ...data,
        userId: req.session.userId!,
      });
      res.json(log);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request data", details: error.errors });
      }
      console.error("Health log error:", error);
      res.status(500).json({ error: "Failed to create health log" });
    }
  });

  app.get("/api/health-logs/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (userId !== req.session.userId && req.session.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const logs = await storage.getHealthLogsByUser(userId);
      res.json(logs);
    } catch (error) {
      console.error("Get health logs error:", error);
      res.status(500).json({ error: "Failed to fetch health logs" });
    }
  });

  app.get("/api/chat-history/:userId", requireAuth, async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (userId !== req.session.userId && req.session.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const history = await storage.getAIChatLogsByUser(userId);
      res.json(history);
    } catch (error) {
      console.error("Get chat history error:", error);
      res.status(500).json({ error: "Failed to fetch chat history" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
