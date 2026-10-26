const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

class LocalStore {
  constructor(directory) {
    fs.mkdirSync(directory, { recursive: true });
    this.file = path.join(directory, "employees.json");
    // Fail visibly on corrupt/unreadable data instead of overwriting it.
    this.rows = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, "utf8")) : [];
    if (!Array.isArray(this.rows)) throw new Error("Invalid local employee data.");
  }
  commit(rows) {
    const temporary = `${this.file}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(rows, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, this.file);
    this.rows = rows;
  }
  public(row) {
    const { _pending, _deleted, _revision, ...employee } = row;
    return employee;
  }
  list(search = "") {
    const term = search.toLowerCase();
    return this.rows.filter(row => !row._deleted && [row.name, row.email, row.designation, row.department].some(value => value.toLowerCase().includes(term)))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || b._id.localeCompare(a._id))
      .map(row => this.public(row));
  }
  save(employee) {
    if (this.rows.some(row => !row._deleted && row._id !== employee._id && row.email === employee.email)) {
      const error = new Error("An employee with this email already exists.");
      error.code = 11000;
      throw error;
    }
    const now = new Date().toISOString();
    const row = { ...employee, createdAt: employee.createdAt || now, updatedAt: now, _pending: true, _revision: randomUUID() };
    this.commit([...this.rows.filter(item => item._id !== row._id), row]);
    return this.public(row);
  }
  update(id, changes) {
    const row = this.rows.find(item => item._id === id && !item._deleted);
    return row ? this.save({ ...this.public(row), ...changes }) : null;
  }
  remove(id) {
    const row = this.rows.find(item => item._id === id && !item._deleted);
    if (!row) return null;
    this.commit(this.rows.map(item => item._id === id ? { ...item, _deleted: true, _pending: true, _revision: randomUUID() } : item));
    return this.public(row);
  }
  pending() { return this.rows.filter(row => row._pending).map(row => ({ ...row })); }
  acknowledge(id, revision) {
    this.commit(this.rows.map(row => row._id === id && row._revision === revision ? { ...row, _pending: false } : row));
  }
  merge(remote) {
    const pending = this.rows.filter(row => row._pending);
    const protectedIds = new Set(pending.map(row => row._id));
    this.commit([...pending, ...remote.filter(row => !protectedIds.has(String(row._id))).map(row => ({ ...row, _id: String(row._id), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(), _pending: false }))]);
  }
}

module.exports = { LocalStore };
