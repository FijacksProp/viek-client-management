# VIEK Client Management Assessment

This repository contains the supplied client management app after debugging. The frontend is React with Vite; the backend is an Express API. The app supports demo login, listing and managing clients, and viewing projects by client.

## Run locally

Use two terminals from the project folder. Start the backend in one:

```powershell
cd server
npm install
npm start
```

Start the frontend in the other:

```powershell
cd client
npm install
npm run dev
```

Open `http://localhost:5173`. The backend listens on `http://localhost:4000`; its routes are under `/api`, so opening the backend root `/` returns Express's `Cannot GET /` message. Use `admin@viek.test` and `password123` to log in. On Windows, use `npm.cmd` if PowerShell blocks the `npm.ps1` script. The project was run with Node.js `v24.14.1` and npm `11.11.0`.

## Bugs found and fixes

- **Blank login page:** The browser console reported `React is not defined`. `App.jsx` used JSX but imported only React hooks. I added the default React import.
- **Dashboard went blank after login:** The first render called `projects.map()` while `projects` was still undefined, before the request finished. I initialized it as an empty array. That exposed a second mismatch: the clients API returns `{ data: [...] }`, but the frontend read `result.clients`. I changed it to read `result.data`.
- **Project filters returned no results:** Express query parameters are strings, while project `clientId` values are numbers. I convert the selected ID to a number before comparing. The results are 3 projects for all clients, 2 for Acme Limited, and 1 for Bright Solutions.
- **Client creation failed:** The frontend did not label its request body as JSON, so Express's `express.json()` middleware did not parse it. I added the `Content-Type: application/json` header. The server now also rejects blank names, invalid email addresses, and fields with the wrong types.
- **Client deletion returned "Client not found":** Express provides route parameters as strings, while client IDs are numbers. I convert the route ID before comparing it with stored IDs.
- **Login response exposed the password:** The route returned the stored user object. It now returns only the user's ID, name, and email. The password remains hardcoded and stored in plaintext in this demo; see limitations below.
- **Client IDs could be reused after deletion:** Calculating an ID from the current client count could repeat an existing ID. A counter now starts above the highest seeded ID and keeps increasing.
- **API failures were hard to understand:** The frontend now checks HTTP responses and catches network errors for login, client and project loading, client creation, and deletion. It displays the server's message when available. A 401 from an authenticated request clears the saved token and returns to login.

## Tests and verification

Run the automated API tests from the `server` folder:

```powershell
npm test
```

The tests cover successful and failed login, missing or invalid authentication, client input validation, malformed JSON, client creation and deletion, project filtering, unique IDs after deletion, and the current project behavior when a client is deleted. The latest run passed all 9 tests.

During debugging, I checked login, client listing, adding and deleting a temporary client, and the project filters in the browser. The filter counts were 3 for all clients, 2 for Acme Limited, and 1 for Bright Solutions. After restarting both servers for the final check, I confirmed that Vite served the app and its transformed React module. Against the live API, I checked successful and failed login (200 and 401), missing and invalid tokens (401), client listing, project filtering (3, 2, and 1 projects), invalid client input (400), and creating and deleting a temporary client. I could not repeat the interactive browser check for the new expired-token message in this final pass; that behavior is implemented in the frontend but is not covered by a browser automation test. The client and project data are in memory, so changes reset when the backend restarts.

## Security and known limitations

- The demo credentials are hardcoded, and the password is stored in plaintext. A real service should hash passwords and keep account data in a database.
- Every successful login receives the same fixed `demo-token`; it has no expiry or revocation. The frontend stores it in `localStorage` and clears it after an authenticated request receives HTTP 401. This is not production-grade authentication.
- Error handling now covers HTTP and network failures in the five current frontend API actions, and the backend returns a generic response for unexpected errors. The app still has no React error boundary or structured backend error logging.
- Client and project data are stored in memory and reset when the server restarts.
- `cors()` allows requests from any origin. A deployed app should restrict allowed origins to the frontend domain.
- Email validation uses a simple format check; it does not verify that an address exists.
- Deleting a client does not delete or reassign that client's projects. For example, deleting Acme Limited leaves its two project records with `clientId: 1`. I kept the supplied behavior and documented it because the assessment does not specify a cascade or reassignment rule.
- The initial dependency audit on 2026-10-15 reported 2 client findings (1 moderate, 1 high) involving Vite `5.4.10` and esbuild, and 4 server findings (2 moderate, 2 high) involving Express `4.21.1`, body-parser, path-to-regexp, and qs. I did not upgrade dependencies as part of this debugging pass.

## Reflection

The dashboard blanking after login took the most investigation because two faults appeared in sequence. I checked the browser error, followed the component's initial render, and then compared the clients response with the shape the frontend expected. Fixing the undefined projects state exposed the separate response-property mismatch.

I learned to check both the browser console and the actual API response when debugging a frontend/backend issue. I also saw why a React component must handle its initial render before asynchronous data arrives, and why API field types and response shapes need to agree on both sides.

With more time, I would replace the demo authentication and in-memory data with persistent storage and properly hashed passwords, restrict CORS, and update dependencies after checking compatibility. I would also agree on a client deletion rule with the product owner before changing what happens to related projects.
