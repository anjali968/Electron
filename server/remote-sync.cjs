async function syncRemote(store, baseUrl, token, fetcher = fetch) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("REMOTE_API_URL must use HTTPS.");
  }
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/api/sync`;
  async function request(options = {}) {
    const response = await fetcher(endpoint, {
      ...options,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const error = new Error(`Cloud sync failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }
  for (const entry of store.pending()) {
    const { _pending, _revision, ...employee } = entry;
    await request({ method: "POST", body: JSON.stringify(employee) });
    store.acknowledge(entry._id, _revision);
  }
  const snapshot = await request();
  if (!Array.isArray(snapshot.data) || snapshot.data.some(row =>
    !row || typeof row._id !== "string" || ["name", "email", "designation", "department"].some(key => typeof row[key] !== "string") ||
    !Number.isFinite(Date.parse(row.createdAt)) || !Number.isFinite(Date.parse(row.updatedAt))
  )) throw new Error("Invalid cloud snapshot; local data preserved.");
  store.merge(snapshot.data);
}

module.exports = { syncRemote };
