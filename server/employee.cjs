const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  designation: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  department: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 }
}, { timestamps: true });

employeeSchema.index({ email: 1 }, { unique: true });
const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

function validateEmployee(body) {
  if (!body || typeof body !== "object") return "Employee details are required.";
  const fields = ["name", "email", "designation", "department"];
  for (const field of fields) {
    if (typeof body[field] !== "string" || !body[field].trim()) {
      return `${field} is required.`;
    }
  }
  for (const field of fields) {
    const max = field === "email" ? 160 : 80;
    if (body[field].trim().length > max || (field !== "email" && body[field].trim().length < 2)) return `${field} must contain ${field === "email" ? "1" : "2"}–${max} characters.`;
  }
  if (body.name.trim().length < 2) return "Name must be at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) return "Enter a valid email address.";
  return null;
}

module.exports = { Employee, validateEmployee };
