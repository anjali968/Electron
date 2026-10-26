const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { LocalStore } = require("./local-store.cjs");
const { Employee, validateEmployee } = require("./employee.cjs");
const { syncRemote } = require("./remote-sync.cjs");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI;
const REMOTE_API_URL = process.env.REMOTE_API_URL;
let cloudConnected = false;
const store = new LocalStore(process.env.EMPLOYEE_DATA_DIR || path.join(require("node:os").homedir(), ".employee-manager"));
let syncError = "";
let syncing = false;

function storageStatus() {
  return { mode: cloudConnected && !syncError ? "online" : "offline", pending: store.pending().length, syncing, syncError };
}

async function syncCloud() {
  if (syncing || (!REMOTE_API_URL && (!MONGO_URI || MONGO_URI.includes("<db_username>")))) return;
  syncing = true;
  try {
    if (REMOTE_API_URL) {
      await syncRemote(store, REMOTE_API_URL, process.env.SYNC_TOKEN);
      cloudConnected = true;
      syncError = "";
      return;
    }
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000, socketTimeoutMS: 5000 });
    }
    for (const entry of store.pending()) {
      const { _pending, _deleted, _revision, ...employee } = entry;
      if (_deleted) await Employee.deleteOne({ _id: entry._id });
      else await Employee.replaceOne({ _id: entry._id }, employee, { upsert: true, runValidators: true });
      store.acknowledge(entry._id, _revision);
    }
    store.merge(await Employee.find().lean());
    cloudConnected = true;
    syncError = "";
  } catch (err) {
    cloudConnected = false;
    syncError = err.code === 11000 || err.status === 409 ? "Email conflict in Atlas. Edit the pending employee email to retry." : "Cloud unavailable. Changes are saved on this device.";
    console.error("[Sync]", err.message);
  } finally { syncing = false; }
}

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// The desktop renderer only talks to this local API. Restrict browser origins to local development.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === "http://127.0.0.1:5173" || origin === "file://" || origin === "null") {
    res.setHeader("Access-Control-Allow-Origin", origin || "http://127.0.0.1:5173");
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (req, res) => {
  res.json({ ok: true, database: "local", storage: storageStatus() });
});

app.get("/api/employees", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 10;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const all = store.list(search);
    const total = all.length;
    const employees = all.slice((page - 1) * limit, page * limit);
    const totalPages = Math.ceil(total / limit);
    res.json({
      data: employees,
      storage: storageStatus(),
      pagination: {
        page, limit, total, totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (err) { next(err); }
});

app.post("/api/employees", async (req, res, next) => {
  const validationError = validateEmployee(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const employee = store.save({
      _id: new mongoose.Types.ObjectId().toString(),
      name: req.body.name.trim(),
      email: req.body.email.trim().toLowerCase(),
      designation: req.body.designation.trim(),
      department: req.body.department.trim()
    });
    res.status(201).json(employee);
  } catch (err) { next(err); }
});

app.put("/api/employees/:id", async (req, res, next) => {
  const validationError = validateEmployee(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid employee ID." });
  }
  try {
    const employee = store.update(req.params.id, {
      name: req.body.name.trim(),
      email: req.body.email.trim().toLowerCase(),
      designation: req.body.designation.trim(),
      department: req.body.department.trim()
    });
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json(employee);
  } catch (err) { next(err); }
});

app.delete("/api/employees/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid employee ID." });
  }
  try {
    const employee = store.remove(req.params.id);
    if (!employee) return res.status(404).json({ message: "Employee not found." });
    res.json({ message: "Employee deleted successfully." });
  } catch (err) { next(err); }
});

app.use((err, req, res, next) => {
  console.error("[API]", err.message);
  if (err.code === 11000) return res.status(409).json({ message: "An employee with this email already exists." });
  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: "Unexpected server error. Check the terminal logs." });
});

async function start() {
  app.listen(PORT, "127.0.0.1", () => console.log(`Employee API listening on http://127.0.0.1:${PORT} (local storage ready)`));
  void syncCloud();
  setInterval(() => void syncCloud(), 15000).unref();
}

if (require.main === module) start();
module.exports = { app, validateEmployee };
