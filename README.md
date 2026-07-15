# DayStar Backend

This is the backend REST API service for the DayStar Ecommerce application. It is built using NestJS, TypeScript, and integrates with Supabase (Auth/Database) and Resend (Emails).

## Tech Stack
* **Framework:** NestJS (TypeScript, REST API)
* **Authentication & Database:** Supabase JS SDK (JWT verification & DB queries)
* **Emails:** Resend SDK
* **Containerization:** Docker (Node 22-alpine multi-stage build)

---

## Setup & Configuration

### 1. Environment Variables
Create a `.env` file at the root of the project:
```bash
cp .env.example .env
```
Open `.env` and fill in the required environment variables:
* `PORT`: The port the backend will run on (default: `3002`).
* `SUPABASE_URL`: Your Supabase Project URL.
* `SUPABASE_PUBLISHABLE_KEY`: Used strictly to verify client JWTs against Supabase's JWKS.
* `SUPABASE_SECRET_KEY`: Used for privileged server-side database access (bypassing RLS).
* `FRONTEND_URL`: The URL where the frontend runs (e.g. `http://localhost:3000`), used for CORS configuration.
* `RESEND_APIKEY`: Your API key for sending emails via Resend.

---

## Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run start:dev
```
The server will start by default at `http://localhost:3002`.

### 3. Verify Health Check
Send a GET request to `http://localhost:3002/health`. You should receive:
```json
{
  "status": "ok"
}
```

---

## Running in Docker

This repository includes a multi-stage Docker build optimized for production. It uses Node.js 22 to support native WebSockets required by the Supabase Realtime client.

### 1. Build the Docker Image
```bash
docker build -t daystar-backend .
```

### 2. Run the Container
Pass the `.env` file and map the port (`3002`):
```bash
docker run --env-file .env -p 3002:3002 daystar-backend
```

---

## Folder Structure
* `src/auth/`: Contains guards/decorators for parsing and validating Supabase JWTs.
* `src/supabase/`: The database & auth client service.
* `src/Resend/`: Email notification module.
* `src/product/`, `src/orders/`, `src/addresses/`: Core ecommerce domain models & business logic.
