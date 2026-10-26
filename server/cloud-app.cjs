const express = require("express");
const mongoose = require("mongoose");
const { timingSafeEqual } = require("node:crypto");
const { Employee, validateEmployee } = require("./employee.cjs");

let connectionPromise;
async function connectDatabase() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured.");
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, maxPoolSize: 5, bufferCommands: false
    }).finally(() => { connectionPromise = null; });
  }
  await connectionPromise;
  await Employee.init();
}

function createCloudApp({ model = Employee, connect = connectDatabase, getToken = () => process.env.SYNC_TOKEN } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.get(["/health", "/api/health"], (req, res) => res.json({ ok: true, service: "employee-cloud-api" }));
  app.use((req, res, next) => {
    const token = getToken();
    if (!token) return res.status(503).json({ message: "SYNC_TOKEN is not configured on the backend." });
    const supplied = Buffer.from(req.headers.authorization || "");
    const expected = Buffer.from(`Bearer ${token}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return res.status(401).json({ message: "Invalid sync credentials." });
    }
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.use(async (req, res, next) => {
    try { await connect(); next(); }
    catch (err) { console.error("[Cloud database]", err.message); res.status(503).json({ message: "Cloud database unavailable. Retry later." }); }
  });
  app.get("/api/sync", async (req, res, next) => {
    try { res.json({ data: await model.find().sort({ _id: 1 }).lean() }); }
    catch (err) { next(err); }
  });
  // Client-generated IDs make retrying a create/delete after a lost response safe.
  app.post("/api/sync", async (req, res, next) => {
    const body = req.body;
    if (!body || !/^[a-f0-9]{24}$/i.test(body._id || "")) return res.status(400).json({ message: "Invalid employee ID." });
    if (body._deleted !== undefined && typeof body._deleted !== "boolean") return res.status(400).json({ message: "Invalid delete flag." });
    try {
      if (body._deleted) {
        await model.deleteOne({ _id: body._id });
      } else {
        const error = validateEmployee(body);
        if (error) return res.status(400).json({ message: error });
        const date = new Date(body.createdAt);
        if (!Number.isFinite(date.getTime())) return res.status(400).json({ message: "Invalid creation date." });
        await model.findOneAndUpdate({ _id: body._id }, {
          $set: { name: body.name.trim(), email: body.email.trim().toLowerCase(), designation: body.designation.trim(), department: body.department.trim() },
          $setOnInsert: { createdAt: date }
        }, { upsert: true, new: true, runValidators: true });
      }
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
  app.get("/api/employees", async (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const filter = search ? { $or: ["name", "email", "designation", "department"].map(field => ({ [field]: { $regex: pattern, $options: "i" } })) } : {};
      const [data, total] = await Promise.all([model.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]);
      const totalPages = Math.ceil(total / limit);
      res.json({ data, pagination: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 } });
    } catch (err) { next(err); }
  });
  app.use((err, req, res, next) => {
    console.error("[Cloud API]", err.message);
    if (err.code === 11000) return res.status(409).json({ message: "An employee with this email already exists." });
    if (["ValidationError", "CastError"].includes(err.name) || err.status === 400) return res.status(400).json({ message: "Invalid employee data." });
    res.status(500).json({ message: "Cloud request failed. Retry later." });
  });
  return app;
}

module.exports = { createCloudApp };
