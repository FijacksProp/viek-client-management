# VIEK Client Management Assessment

This is the supplied client management app after a debugging pass. I kept a record of what I found, what changed, and how I checked the main features.

## Run locally

Open two terminals from the project folder. Start the backend in one:

```powershell
cd server
npm install
npm start
```

Then start the frontend in the other:

```powershell
cd client
npm install
npm run dev
```

The backend runs at `http://localhost:4000`; Vite runs at `http://localhost:5173`.

Use `admin@viek.test` and `password123` to log in. On this Windows setup, run `npm.cmd` instead of `npm` if PowerShell blocks the `npm.ps1` script. I used Node.js `v24.14.1` and npm `11.11.0`.

## What I found

### The page was blank before login

The browser console showed `React is not defined`. `App.jsx` used the React JSX transform but imported only the hooks. I added the default React import, and the login page appeared.

### The dashboard went blank after login

The dashboard called `projects.map()` before the projects request had finished. Since `projects` started as `undefined`, the render failed. I initialized it to an empty array so the dashboard can render while data loads. This exposed another issue: the clients request returned `{ "data": [...] }`, but the frontend tried to read `result.clients`. Updating it to `result.data` stopped the dashboard from disappearing. The login and dashboard then stayed visible.

### Filtering projects by client returned nothing

Express gives query parameters to the route as strings, while the sample `clientId` values are numbers. Strict equality therefore didn't match `"1"` with `1`. I converted the query value to a number. The API returned 3 projects for all clients, 2 for Acme Limited, and 1 for Bright Solutions; I also checked both filters in the browser.

### Adding a client failed validation

The frontend sent JSON but didn't set `Content-Type: application/json`, so Express's `express.json()` middleware didn't parse the submitted fields. I added the header. The browser then showed “Client added successfully” and displayed the new client.

### Deleting a client returned “Client not found”

Express provides `req.params.id` as a string, but the stored IDs are numbers. I converted the route parameter before comparing it with the client IDs. The API and the dashboard both confirmed that deletion worked.

### The login response included the password

The route returned its stored user object, including the plaintext password. I changed the response to return only the user's ID, name, and email. I checked that the password was absent from the response and that the returned token still allowed access to the clients endpoint. Invalid credentials and a missing token returned HTTP 401.

### Adding a client after deleting one could reuse an ID

The original `clients.length + 1` calculation could repeat an ID after a client was removed. I replaced it with a counter initialized above the highest seeded ID. In the create, delete, create check, IDs 3 and 4 were created, ID 3 was deleted, and the next client received ID 5. There were no duplicate IDs.

## Final check and remaining notes

After the fixes, I refreshed the app and checked the project list again: All Clients showed 3 projects, Acme Limited showed 2, and Bright Solutions showed 1. I added and deleted a temporary client in the browser. The API then showed only the two seeded clients, IDs 1 and 2. Checks were manual in the browser and through API requests; the supplied client has no build script.

The backend has no `/` route, so `Cannot GET /` at port `4000` is expected; its routes are under `/api`. Client and project data are held in memory and reset when the backend restarts.

Authentication is for this demo only. The credentials are hardcoded, the password is stored in plaintext, and each successful login receives the same fixed `demo-token` with no expiry. The login response no longer returns the password, but the authentication design isn't suitable for production. The server also allows requests from any origin through `cors()`; a deployed app should restrict this to its frontend.

The initial `npm audit` on 2026-10-15 reported 2 client findings (1 moderate, 1 high) involving Vite `5.4.10` and esbuild, and 4 server findings (2 moderate, 2 high) involving Express `4.21.1`, body-parser, path-to-regexp, and qs. I did not upgrade dependencies during this debugging pass.
