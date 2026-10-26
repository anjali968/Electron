# Employee Desktop CRUD (MongoDB Atlas)

A JavaScript desktop app built with Electron, React, Tailwind CSS, Express and MongoDB Atlas.

## Requirements

- Node.js and npm
- MongoDB Atlas account and a cluster (optional, for cloud sync)
- An Atlas database user (for cloud sync)
- Your current public IP added to the Atlas Network Access list (or an appropriately restricted network rule)

## 1. Configure MongoDB Atlas

1. Sign in to [MongoDB Atlas](https://cloud.mongodb.com/).
2. Create a project and a free cluster if you don't already have one.
3. Under **Database Access**, create a database user and save its username/password.
4. Under **Network Access**, add your current IP address.
5. Open your cluster's **Connect → Drivers → Node.js** and copy the connection URI.
6. In the project root, copy `.env.example` to `.env`.
7. Replace the placeholder `MONGO_URI` with your Atlas URI. Add `/employee_manager` before the query string if the copied URI doesn't include a database name.

Example (replace all placeholders; don't copy literally):
`mongodb+srv://DB_USER:DB_PASSWORD@cluster0.xxxxx.mongodb.net/employee_manager?retryWrites=true&w=majority`

If the password contains special characters, URL-encode it. Do not share or commit your `.env` file.

## 2. Install and run

```bash
npm install
cp .env.example .env
# Optionally edit .env and set MONGO_URI for cloud sync
npm run dev
```

The app starts:
- Vite/React at `http://127.0.0.1:5173`
- Express API at `http://127.0.0.1:4000`
- Electron desktop window after both are ready

No local MongoDB server or `mongosh` is required when using Atlas.

## 3. CRUD API

- `GET /api/employees` — list employees
- `POST /api/employees` — create
- `PUT /api/employees/:id` — update
- `DELETE /api/employees/:id` — delete
- `GET /health` — API and database status

Employee fields: `name`, `email`, `designation`, `department`.

## 4. Build and tests

```bash
npm test
npm run build
npm run dist
```

Build output is written to `dist/`.

## Security notes

- Electron uses `contextIsolation: true`, `nodeIntegration: false`, sandboxing, and a narrow preload bridge.
- The renderer never receives the Atlas URI.
- Keep `.env` private. This educational desktop app runs a local Express API bound to `127.0.0.1`; for production distribution, use a per-install secret/authentication, avoid shipping shared database credentials, and review packaged-server/environment handling.
- Atlas IP access rules should be limited to trusted IPs. Avoid `0.0.0.0/0` except for temporary testing when you understand the risk.


## Server-side search and pagination

The employee list endpoint supports `page` (default `1`), `limit` (default `10`, maximum `100`), and `search` (matches name, email, designation, or department).

Example: `GET /api/employees?page=2&limit=10&search=engineering`

The API returns a `data` array and pagination metadata (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPrevPage`). The UI debounces the search input and requests filtered, paginated results from Express/local storage.

## Offline use and automatic sync

The API starts immediately using a local `employees.json` file. Internet and Atlas are optional. Add, edit, delete, search and pagination work offline, including after restarting the app.

- Development data: `~/.employee-manager/employees.json`. Override with `EMPLOYEE_DATA_DIR` if needed.
- Installed desktop app data: Electron's writable `userData` directory.
- If `MONGO_URI` is configured, the server retries cloud sync every 15 seconds. It uploads pending changes and downloads the Atlas employee directory. Existing Atlas data must be synced once online before it is available offline.
- The app shows cloud availability and the number of pending changes. Local changes to a record take priority during sync; this is not a multi-user conflict resolution system.
- A duplicate email in Atlas pauses sync and leaves local changes intact. Update that employee's email and sync will retry.
- Keep a backup of the local data file. Each installation has its own offline copy; development and the installed app use separate directories.

To test: run `npm run dev`, disconnect internet, add/edit/delete employees, restart, and verify records remain. Reconnect to upload pending changes. Rebuild the installer with `npm run dist` to include these changes in the installed app.
