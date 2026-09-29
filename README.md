# Rent Desk

React frontend for tenant management and live rent tracking.

## Run locally

Install dependencies with `npm install`, then run `npm run dev`. The Vite dev server proxies `/api` requests to `http://localhost:3000` by default; set `VITE_API_PROXY_TARGET` to use another backend URL.

The production frontend expects the V4 backend on the same origin. If it is hosted separately, set `API_BASE` in `api.js` to the backend URL and configure backend CORS.

The backend must provide login, overview, tenant create/update, reminder, and server-sent event routes described in `api.js`.
