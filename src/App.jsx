import { useCallback, useEffect, useState } from "react";
const API = "http://127.0.0.1:4000/api/employees";
const emptyForm = { name: "", email: "", designation: "", department: "" };

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
  } catch {
    throw new Error("Cannot reach the API. Check that the app server is running.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Request failed.");
  return data;
}

function Field({ label, name, value, onChange, error, placeholder, type = "text" }) {
  return <label className="block">
    <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
    <input
      className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${error ? "border-red-400" : "border-slate-200"}`}
      name={name} type={type} value={value} placeholder={placeholder}
      onChange={onChange} autoComplete="off"
    />
    {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
  </label>;
}

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [storage, setStorage] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    page: 1, limit: 10, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), search: debouncedQuery });
      const result = await request(`${API}?${params.toString()}`);
      setEmployees(result.data);
      setStorage(result.storage);
      setPagination(result.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQuery]);

  useEffect(() => {
    loadEmployees();
    const timer = setInterval(loadEmployees, 15000);
    return () => clearInterval(timer);
  }, [loadEmployees]);

  function validate() {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = "Enter at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email.";
    if (form.designation.trim().length < 2) errors.designation = "Enter a designation.";
    if (form.department.trim().length < 2) errors.department = "Enter a department.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function change(e) {
    setForm(current => ({ ...current, [e.target.name]: e.target.value }));
    setFieldErrors(current => ({ ...current, [e.target.name]: "" }));
    setNotice("");
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setFieldErrors({});
  }

  async function submit(e) {
    e.preventDefault();
    setNotice("");
    setError("");
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]));
      if (editingId) {
        await request(`${API}/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice("Employee updated successfully.");
        setTimeout(() => {
          setNotice("");
        }, 3000);
      } else {
        await request(API, { method: "POST", body: JSON.stringify(payload) });
        setNotice("Employee added successfully.");
        setTimeout(() => {
          setNotice("");
        }, 3000);
      }
      resetForm();
      if (!editingId) setPage(1);
      await loadEmployees();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  function edit(employee) {
    setEditingId(employee._id);
    setForm({ name: employee.name, email: employee.email, designation: employee.designation, department: employee.department });
    setFieldErrors({});
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function remove(employee) {
    if (!window.confirm(`Delete ${employee.name}? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await request(`${API}/${employee._id}`, { method: "DELETE" });
      setNotice("Employee deleted successfully.");
      setTimeout(() => {
        setNotice("");
      }, 3000);
      if (editingId === employee._id) resetForm();
      await loadEmployees();
    } catch (err) { setError(err.message); }
  }

  return <div className="min-h-screen bg-slate-50">
    <header className="bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500 text-lg font-bold">E</div>
          <div><h1 className="text-xl font-semibold tracking-tight">Employee Manager</h1></div>
        </div>
        <div className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">{window.desktopApp?.appName || "Employee CRUD"}</div>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div><h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Employee directory</h2><p className="mt-1 text-sm text-slate-500">Create, update and manage employee records.</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm"><p className="text-xs text-slate-500">Total employees</p><p className="text-2xl font-bold text-slate-900">{pagination?.total}</p></div>
      </div>

      {storage && <div role="status" className="mb-5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {storage.mode === "online" ? "Cloud connected" : "Offline mode — records are saved on this device"}
        {storage.pending > 0 && ` · ${storage.pending} change(s) waiting to sync`}
        {storage.syncError && <p className="mt-1">{storage.syncError}</p>}
      </div>}
      {error && <div role="alert" className="mb-5 flex items-start justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><span>{error}</span><button className="ml-4 font-semibold" onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between"><div><h3 className="font-semibold text-slate-900">{editingId ? "Edit employee" : "Add a new employee"}</h3><p className="mt-1 text-sm text-slate-500">{editingId ? "Update the employee information below." : "Fill in the details to create an employee record."}</p></div>{editingId && <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Editing record</span>}</div>
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full name" name="name" value={form.name} onChange={change} error={fieldErrors.name} placeholder="e.g. Anjali Gupta" />
            <Field label="Email address" name="email" value={form.email} onChange={change} error={fieldErrors.email} placeholder="name@company.com" type="email" />
            <Field label="Designation" name="designation" value={form.designation} onChange={change} error={fieldErrors.designation} placeholder="e.g. Frontend Developer" />
            <Field label="Department" name="department" value={form.department} onChange={change} error={fieldErrors.department} placeholder="e.g. Engineering" />
          </div>
          <div className="mt-5 flex gap-3"><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60">{saving ? "Saving..." : editingId ? "Save changes" : "Add employee"}</button>{editingId && <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>}</div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold text-slate-900">All employees</h3><p className="mt-1 text-sm text-slate-500">{pagination?.total} record{pagination?.total === 1 ? "" : "s"} found</p></div><div className="flex flex-wrap gap-2"><input aria-label="Search employees" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, email, designation..." className="w-64 rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button onClick={loadEmployees} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Refresh</button></div></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-6 py-3.5 font-semibold">Employee</th><th className="px-6 py-3.5 font-semibold">Designation</th><th className="px-6 py-3.5 font-semibold">Department</th><th className="px-6 py-3.5 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">Loading employees...</td></tr> :
                employees?.length === 0 ? <tr><td colSpan="4" className="px-6 py-12 text-center"><p className="font-medium text-slate-700">{debouncedQuery ? "No matching employees" : "No employees yet"}</p><p className="mt-1 text-sm text-slate-500">{debouncedQuery ? "Try another search." : "Add your first employee using the form above."}</p></td></tr> :
                  employees.map(employee => <tr key={employee._id} className="transition hover:bg-slate-50/80">
                    <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{employee.name.split(/\s+/).map(s => s[0]).join("").slice(0, 2).toUpperCase()}</div><div><p className="font-semibold text-slate-800">{employee.name}</p><p className="mt-0.5 text-xs text-slate-500">{employee.email}</p></div></div></td>
                    <td className="px-6 py-4 text-slate-600">{employee.designation}</td><td className="px-6 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{employee.department}</span></td>
                    <td className="px-6 py-4"><div className="flex justify-end gap-2"><button onClick={() => edit(employee)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Edit</button><button onClick={() => remove(employee)} className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button></div></td>
                  </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page</span>
            <select aria-label="Rows per page" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-500">
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
            </select>
            <span className="ml-2">{pagination?.total === 0 ? "0 records" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, pagination.total)} of ${pagination.total}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!pagination.hasPrevPage || loading} onClick={() => setPage(current => Math.max(1, current - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <span className="min-w-20 text-center text-sm text-slate-600">Page {pagination.totalPages === 0 ? 0 : page} of {pagination.totalPages}</span>
            <button type="button" disabled={!pagination.hasNextPage || loading} onClick={() => setPage(current => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>

    </main>
  </div>;
}
