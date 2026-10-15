# VIEK Client Management Assessment

## Current status

This repository contains the supplied Client Management application after a debugging and verification pass. This log records confirmed symptoms, causes, changes, and verification. Login response, dashboard rendering, client addition/deletion, unique client IDs after deletion, and project viewing/filtering have been checked. Security limitations and the initial dependency audit findings are also documented.

## Run the application

In one terminal, install and start the backend:

```powershell
cd server
npm install
npm start
```

In a second terminal, install and start the frontend:

```powershell
cd client
npm install
npm run dev
```

The backend listens at `http://localhost:4000` and Vite serves the frontend at `http://localhost:5173`.

Assessment login: `admin@viek.test` / `password123`.

On this Windows PowerShell setup, use `npm.cmd` in place of `npm` if PowerShell blocks the `npm.ps1` shim under its execution policy. This environment has Node.js `v24.14.1` and npm `11.11.0`.

## Debugging log

### 1. Initial blank page

**Cause:** `App.jsx` used the Vite JSX transform, which emits `React.createElement(...)`, but imported only the React hooks. The browser console showed `React is not defined` at `App.jsx:152:5`.

**Change:** The default `React` import was added alongside `useState` and `useEffect`.

**Verification:** The user confirmed that the login page appeared after this change.

### 2. Blank page after login

**Cause:** `projects` had no initial value (`undefined`), while the authenticated dashboard immediately renders `projects.map(...)`. React renders after the token changes before the `useEffect` API requests finish, so this state could throw during rendering.

**Change:** Initialized `projects` as an empty array with `useState([])` so the dashboard can render before project data loads.

**Verification:** Vite returned the transformed `App.jsx` with HTTP 200 and the initialized state present. The authenticated projects API returned all three sample projects. The dashboard briefly appeared after this change, then exposed the separate clients issue below. `client/package.json` has only a `dev` script, so `npm.cmd run build` is not available in the supplied project.

### 3. Dashboard disappears after briefly rendering

**Symptom:** After the projects state was initialized, the user saw the dashboard briefly before it returned to a blank page.

**Cause:** `GET /api/clients` responds with `{ "data": [...] }`, but the frontend read `result.clients`. That set `clients` to `undefined`; the dashboard then accessed `clients.length` and `clients.map(...)`.

**Change:** Updated the frontend to read `result.data` in `loadClients()`.

**Verification:** The authenticated clients API returned two client records under `data`. Vite served the updated module with HTTP 200 and the matching `setClients(result.data)` code. The user confirmed that the dashboard stays visible after login.

### 4. Project filter returned no results

**Symptom:** Selecting either client left the project list empty; the unfiltered list showed all projects.

**Cause:** Express exposes query parameters as strings, but each project's `clientId` is a number. The route used strict equality (`===`), so values such as `"1"` and `1` did not match.

**Change:** Convert the query value with `Number(clientId)` when comparing it to the numeric project ID.

**Verification:** The API returned 3 projects with no filter, 2 for Acme Limited (`clientId=1`), and 1 for Bright Solutions (`clientId=2`). I selected both clients in Chrome and confirmed the matching project names appeared.

### 5. Add-client request was rejected

**Symptom:** The user entered a client name and email but received “Name and email are required.”

**Cause:** The frontend serialized the fields as JSON but omitted the `Content-Type: application/json` request header. Express's `express.json()` middleware relies on that content type to parse the request body, so the route's validation did not receive the submitted fields.

**Change:** Added the JSON content type to the add-client request headers.

**Verification:** I submitted a temporary client through Chrome. The app displayed “Client added successfully” and showed the new row. After restarting the backend and reloading, the in-memory test record was gone and the two original sample clients were present again.

### 6. Delete returned “Client not found”

**Symptom:** The user clicked Delete for a client that was listed in the dashboard and received “Client not found.”

**Cause:** Express provides `req.params.id` as a string, while stored client IDs are numbers. The route compared them with strict inequality, so the matching client was never removed.

**Change:** Convert `req.params.id` to a number before filtering the clients array.

**Verification:** I created a temporary client through the API, deleted it, received “Client deleted successfully,” and confirmed `GET /api/clients` returned the two original clients. The user then confirmed deletion also works through the dashboard.

### 7. Login response exposed the password

**Cause:** The login route returned its stored `user` object directly, including the plaintext password field.

**Change:** The response now includes only the user's `id`, `name`, and `email`.

**Verification:** The login API response contained only `id`, `name`, and `email`; it did not contain `password`. The returned token still authorized `GET /api/clients`, which returned both seeded records. Invalid credentials and a missing bearer token each returned HTTP 401.

### 8. Adding a client after deletion could reuse an ID

**Symptom:** After creating clients with IDs 3 and 4, deleting ID 3, and creating another client, the new client also received ID 4.

**Cause:** The route assigned IDs with `clients.length + 1`. Deleting an item reduces the array length, so that formula can produce an ID that is already in use.

**Change:** Added a `nextClientId` counter initialized to one greater than the highest seeded client ID. Each successful creation uses the counter and increments it.

**Verification:** Repeated the create (IDs 3 and 4), delete (ID 3), create sequence. The last client received ID 5, and the active IDs were 1, 2, 4, and 5 with no duplicates. Restarted the backend afterward and confirmed the temporary records were cleared and only seeded clients 1 and 2 remained.

### 9. Final browser pass

**Verification:** The user refreshed the app, logged in, and confirmed All Clients showed 3 projects, Acme Limited showed 2, and Bright Solutions showed 1. The user then added a temporary client and deleted it successfully after the ID counter change. A follow-up API check showed only the two seeded clients remained.

## Security notes and remaining behavior

- The backend listens on port `4000`; Vite serves the frontend on port `5173`. There is no backend `/` route, so `Cannot GET /` at port `4000` is expected; API routes are under `/api`.
- Authentication remains demo-only: credentials are hardcoded in source, the password is stored in plaintext, and every successful login receives the same fixed `demo-token` with no expiry. The login response no longer exposes the password, but this token scheme is not suitable for production.
- The server uses unrestricted `cors()`; a deployed application should allow only its intended frontend origin.
- The initial `npm audit` on 2026-10-15 reported 2 client findings (1 moderate, 1 high) involving Vite `5.4.10` and transitive esbuild, and 4 server findings (2 moderate, 2 high) involving Express `4.21.1` and transitive body-parser, path-to-regexp, and qs. No dependency upgrades have been applied.
