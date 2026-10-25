# MiniLedger

MiniLedger is a full-stack personal finance web application designed for tracking money lent to friends and managing repayments. Built with React, TypeScript, Node.js, Express, Prisma, and PostgreSQL, it provides passwordless phone-number OTP authentication, transparent ledger tracking, visual overdue loan alerts, and real-time financial summaries with exact decimal precision.

---

## Live Demo & Links

- **Live Demo:** [https://miniledger-seven.vercel.app/](https://miniledger-seven.vercel.app/)
- **GitHub Repository:** [https://github.com/Samakcha/miniledger](https://github.com/Samakcha/miniledger)
- **Demo OTP:** `123456`

### Quick Demo Login Instructions
1. Open the deployed application (or navigate to `http://localhost:5173` if running locally).
2. Enter your mobile phone number, including country code (e.g., `+1 555-019-2834` or `+91 9876543210`).
3. Click **Send One-Time Code**.
4. Enter the demo OTP: `123456`.
5. Click **Verify & Open Dashboard** to access the application.

> [!IMPORTANT]
> **Demo Security Notice**: The fixed demo OTP (`123456`) is intentionally enabled (`DEMO_OTP_ENABLED=true`) solely for public demonstration and reviewer evaluation without requiring SMS gateway infrastructure. Entering a phone number in demo mode does **not** verify ownership of that phone number and is **not suitable for real financial use or real customer data**. Real production authentication requires disabling demo mode (`DEMO_OTP_ENABLED=false`) and implementing genuine phone-number verification via a telecommunications SMS gateway.

---

## Key Features

- **Passwordless Phone OTP Authentication**: Login flow supporting local development (console-logged OTP), a public reviewer demo mode with fixed code `123456` (`DEMO_OTP_ENABLED=true`), and configurable production-ready authentication paths.
- **Interactive Loan Ledger**: Record loans with friend names, amounts, and scheduled due dates.
- **Visual Overdue Alerts**: Past-due unpaid loans are automatically highlighted with prominent red badges and alert styling.
- **One-Click Repayment Tracking**: Mark loans as repaid with a single click, recording an immutable timestamp (`repaidAt`) and updating metrics dynamically.
- **Real-Time Financial Aggregates**: Immediate calculation of **Total Lent**, **Total Repaid**, and **Overdue Amount** backed by database-level decimal arithmetic (`Decimal(12, 2)`).
- **Search & Dynamic Filters**: Fast client-side status filtering (`All`, `Pending`, `Overdue`, `Repaid`) and instant search by friend name.
- **Multi-Tenant User Isolation**: Strict user-level data segregation enforced by JWT authentication; users can only view, create, and mutate their own records.
- **Responsive Touch-First Design**: Optimized for desktop monitors, tablets, and mobile screens with custom CSS, fluid grids, and touch-accessible controls.

---

## Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | React | ^18.3.1 | Single-page application UI |
| | TypeScript | ^5.6.3 | Type-safe frontend architecture |
| | Vite | ^6.0.1 | Frontend build tool and development server |
| | CSS3 | Vanilla | Bespoke, responsive design system without external CSS frameworks |
| **Backend** | Node.js | v18+ LTS | Server runtime environment |
| | Express | ^4.21.2 | RESTful API server framework |
| | TypeScript | ^5.6.3 | Type-safe backend application logic |
| | tsx | ^4.19.2 | High-performance TypeScript execution and test runner |
| **Database & ORM** | PostgreSQL | 14+ / Neon | Relational database (compatible with Neon Serverless PostgreSQL) |
| | Prisma ORM | ^6.2.1 | Type-safe schema definition, migrations, and queries |
| **Security & Auth** | JSON Web Tokens | ^9.0.3 | Stateless Bearer token session authentication |
| | Node Crypto | Native | Cryptographic OTP generation and constant-time string comparison |
| **Testing** | Supertest | ^7.3.1 | End-to-end HTTP integration testing |

---

## Architecture Overview & Data Flow

MiniLedger follows a clean client-server architecture with strict separation of concerns:

```text
[ Browser / Client SPA ]
         │
         │  HTTPS / JSON
         │  Authorization: Bearer <JWT>
         ▼
[ Express API Server ]
    ├── CORS & JSON Body Parsing
    ├── Authentication Middleware (JWT validation, req.user extraction)
    ├── Input Normalization & Validation (E.164 phone, Decimal amounts, ISO dates)
    ├── Rate Limiting & Abuse Protection
    └── Prisma ORM Client
         │
         │  Parameterized SQL (WHERE "userId" = req.user.id)
         ▼
[ PostgreSQL Database (Neon) ]
    ├── User Table (id UUID, phone, createdAt, updatedAt)
    └── Loan Table (id UUID, userId, friendName, amount Decimal(12,2), dueDate, isRepaid, repaidAt)
```

### Core Architectural Decisions
- **Monetary Precision**: Currency amounts are defined as `Decimal(12, 2)` in PostgreSQL and handled using Prisma's `Decimal` type to prevent IEEE 754 floating-point rounding errors.
- **Stateless Session Management**: Authentication is issued as signed JWT tokens stored in browser `localStorage`, eliminating server-side session state for horizontal scalability.
- **Cascading User Isolation**: Database queries explicitly filter by `userId` extracted from verified JWT tokens, preventing cross-user data leakage.

---

## Project Structure

```text
miniledger/
├── client/                      # Frontend React SPA
│   ├── public/                  # Static assets and video backgrounds
│   ├── src/
│   │   ├── components/          # UI components (Navbar, SummaryCards, LoanList, etc.)
│   │   ├── services/api.ts      # Typed API client, token storage & session handling
│   │   ├── types/index.ts       # Shared TypeScript domain interfaces
│   │   ├── App.tsx              # Root component & session state machine
│   │   ├── main.tsx             # React application entry point
│   │   ├── index.css            # Custom responsive design system
│   │   └── vite-env.d.ts        # Vite environment variable type declarations
│   ├── .env.example             # Frontend environment template
│   ├── package.json             # Frontend scripts and dependencies
│   └── vite.config.ts           # Vite configuration
├── server/                      # Backend Express REST API
│   ├── prisma/
│   │   ├── migrations/          # Version-controlled SQL migration history
│   │   └── schema.prisma        # Prisma data models (User, Loan)
│   ├── src/
│   │   ├── lib/prisma.ts        # Singleton Prisma client instance
│   │   ├── middleware/auth.ts   # JWT authentication & validation middleware
│   │   ├── routes/
│   │   │   ├── auth.ts          # Auth routes (/request-otp, /verify-otp, /me)
│   │   │   └── loans.ts         # Loan CRUD, repayment & aggregate summary routes
│   │   ├── services/otp.ts      # OTP generation, verification & rate-limiting engine
│   │   ├── tests/
│   │   │   ├── auth.test.ts     # Automated authentication test suite (18 tests)
│   │   │   └── loans.test.ts    # Automated loan management test suite (11 tests)
│   │   ├── types/express.d.ts   # Express request user typing extensions
│   │   └── index.ts             # Express server setup, middleware & health check
│   ├── .env.example             # Backend environment template
│   ├── package.json             # Backend scripts and dependencies
│   └── tsconfig.json            # Backend TypeScript configuration
├── .gitignore                   # Excludes node_modules, build outputs, and all .env files
└── README.md                    # Project documentation
```

---

## Prerequisites

Ensure the following tools are installed before setting up the application:

- **Node.js**: Version 18.x or later (tested on v20 LTS and v24)
- **npm**: Version 9.x or later (tested on v11)
- **PostgreSQL**: A running PostgreSQL database instance (local PostgreSQL 14+ or a cloud database such as [Neon](https://neon.tech))

---

## Environment Variables

Templates with safe default placeholders are provided in both `client/.env.example` and `server/.env.example`.

### 1. Backend (`server/.env`)

Create `server/.env` by copying `server/.env.example`:

```bash
cp server/.env.example server/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `5001` | Port on which the Express server listens |
| `DATABASE_URL` | **Required** | — | PostgreSQL connection URL (e.g. `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require`) |
| `JWT_SECRET` | **Required** | — | Secret key used to sign and verify JSON Web Tokens |
| `DEMO_OTP_ENABLED` | Optional | `false` | When set to `true`, enables fixed demo OTP verification (`123456`) |

> **Security Note**: `server/.env` is excluded by `.gitignore` and must never be committed to source control.

### 2. Frontend (`client/.env`)

Create `client/.env` by copying `client/.env.example`:

```bash
cp client/.env.example client/.env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_BASE_URL` | **Required** | `http://localhost:5001` | Base URL of the backend Express API |
| `VITE_DEMO_OTP_ENABLED` | Optional | `false` | When set to `true`, displays demo mode notices and instructions |

---

## Installation & Database Setup

### Step 1: Install Dependencies

From the repository root:

```bash
# Install frontend dependencies
npm --prefix client install

# Install backend dependencies
npm --prefix server install
```

### Step 2: Database Migration & Prisma Generation

Ensure `DATABASE_URL` is configured in `server/.env`, then run:

```bash
cd server

# Apply database migrations
npx prisma migrate deploy

# Generate the type-safe Prisma client
npx prisma generate

cd ..
```

*(Note: During local schema modifications, use `npx prisma migrate dev` to generate new migrations).*

---

## Running the Application Locally

### 1. Start the Backend API

In your first terminal:

```bash
cd server
npm run dev
```

The server will start on `http://localhost:5001`. Verify the health check:

```bash
curl http://localhost:5001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "MiniLedger API is running",
  "timestamp": "..."
}
```

### 2. Start the Frontend Client

In a second terminal:

```bash
cd client
npm run dev
```

The Vite dev server will start at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## Authentication Modes & Demo Login

MiniLedger explicitly differentiates public evaluation environments from production authentication requirements:

### 1. Public Reviewer Demo Mode (`DEMO_OTP_ENABLED=true`)
- **Purpose**: Intentionally enabled for hosted demonstration environments (e.g., Vercel) so reviewers and recruiters can evaluate the application workflow without needing an active SMS delivery gateway or access to server terminal logs.
- **Fixed Demo OTP**: `123456`.
- **Security Constraints & Reviewer Notice**:
  - **Does NOT verify phone-number ownership**: Because the fixed code `123456` is accepted for any valid phone number, this mode does not verify physical possession or ownership of the entered phone number.
  - **Not suitable for real financial use**: Intended solely for functional review and UI evaluation; strictly unsuitable for production systems handling real money or customer data.
- **Stateless Serverless Execution**: Verification does not rely on shared in-memory state, ensuring reliable authentication across ephemeral serverless instances.
- **Abuse Protection**: Enforces sliding-window request rate limiting (max 3 requests per 10 minutes) and locks out verification after 5 consecutive invalid codes for 10 minutes (HTTP 429).
- **UI Indication**: The frontend automatically displays a clear `DEMO MODE ACTIVE` banner with instructions to use the demo OTP code `123456`.

### 2. Local Development Mode (`DEMO_OTP_ENABLED=false`)
- **Purpose**: Default mode for local development and offline testing.
- **OTP Generation**: Backend generates a cryptographically secure random 6-digit OTP using `crypto.randomInt(100000, 1000000)`.
- **Delivery**: The OTP is output solely to the backend terminal log:
  ```text
  [AUTH] Generated OTP for +15550192834: 849201
  ```
- **Security**: The OTP is **never exposed in HTTP API responses**. The fixed demo code `123456` is rejected unless explicitly generated.
- **Lifecycle**: Stored in process memory with a 5-minute time-to-live (`TTL = 300000 ms`), limited to 5 verification attempts.

### 3. Real Production Authentication Requirements
To deploy MiniLedger for real financial use or customer-facing production workloads:
1. **Disable Demo Mode**: Set `DEMO_OTP_ENABLED=false` (or leave unset) to reject any static demo codes.
2. **Genuine Phone Verification**: Integrate a commercial telecommunications SMS gateway (e.g., Twilio, AWS SNS, MessageBird) to transmit dynamic, one-time verification codes directly to the recipient's mobile handset, verifying genuine ownership of the phone number.
3. **Distributed Rate Limiting & Session Storage**: Replace in-memory stores with a distributed key-value store (e.g., Redis or Upstash) across serverless instances.
4. **Hardened Token Transport**: Transmit JWT authentication tokens via `HttpOnly`, `Secure`, `SameSite=Strict` cookies with CSRF defense rather than browser `localStorage`.

---

## API Overview

All protected endpoints require an `Authorization: Bearer <token>` header.

### Public Endpoints

#### `GET /api/health`
Health check endpoint confirming API availability.
- **Response `200 OK`**: `{ "status": "ok", "message": "MiniLedger API is running", "timestamp": "..." }`

#### `POST /api/auth/request-otp`
Requests a one-time verification code for a phone number.
- **Body**: `{ "phone": "+1 555-019-2834" }`
- **Response `200 OK`**: `{ "success": true, "message": "OTP sent successfully" }` (or `{ "success": true, "demoMode": true, "message": "..." }`)
- **Response `400 Bad Request`**: Malformed or missing phone number.
- **Response `429 Too Many Requests`**: Rate limit exceeded (max 3 requests per 10 minutes).

#### `POST /api/auth/verify-otp`
Verifies the submitted OTP, creates or retrieves the user in PostgreSQL, and issues a JWT token.
- **Body**: `{ "phone": "+1 555-019-2834", "otp": "123456" }`
- **Response `200 OK`**: `{ "token": "<jwt>", "user": { "id": "<uuid>", "phone": "+15550192834", "createdAt": "..." } }`
- **Response `400 Bad Request`**: Invalid OTP code or expired session.
- **Response `429 Too Many Requests`**: Exceeded maximum verification attempts (5 attempts).

### Protected Endpoints (Require Bearer JWT)

#### `GET /api/auth/me`
Retrieves profile details for the authenticated user.
- **Response `200 OK`**: `{ "user": { "id": "<uuid>", "phone": "+15550192834", "createdAt": "...", "updatedAt": "..." } }`
- **Response `401 Unauthorized`**: Missing or invalid token.

#### `GET /api/loans`
Lists all loans recorded by the authenticated user, ordered by `dueDate ASC, createdAt ASC`.
- **Response `200 OK`**: `{ "loans": [ { "id": "<uuid>", "friendName": "Alex", "amount": "150.00", "dueDate": "...", "isRepaid": false, "repaidAt": null, "createdAt": "...", "updatedAt": "...", "userId": "<uuid>" } ] }`

#### `POST /api/loans`
Records a new loan owned by the authenticated user.
- **Body**:
  ```json
  {
    "friendName": "Alex Rivera",
    "amount": "150.00",
    "dueDate": "2026-11-15T00:00:00.000Z"
  }
  ```
- **Validation**:
  - `friendName`: Non-empty string, max 100 characters.
  - `amount`: Positive numeric string or number with at most 2 decimal places, max `9,999,999,999.99`.
  - `dueDate`: Valid ISO 8601 date string.
- **Response `201 Created`**: `{ "loan": { ... } }`

#### `GET /api/loans/summary`
Calculates aggregated loan totals across the authenticated user's records using exact database decimal arithmetic.
- **Response `200 OK`**:
  ```json
  {
    "totalLent": "1250.00",
    "totalRepaid": "750.00",
    "overdueAmount": "200.00"
  }
  ```

#### `PATCH /api/loans/:id/repay`
Marks a specified loan as repaid. Idempotent: repeating the call preserves the original repayment timestamp.
- **Response `200 OK`**: `{ "message": "Loan marked as repaid successfully", "loan": { ... "isRepaid": true, "repaidAt": "..." } }`
- **Response `404 Not Found`**: Loan ID does not exist or belongs to another user.

---

## Automated Testing

The backend includes a comprehensive automated test suite consisting of **29 tests** covering authentication security, token validation, decimal precision, and loan isolation.

### Running Tests

From the repository root:

```bash
npm --prefix server test
```

Or run individual suites:

```bash
# Run Authentication test suite (18 tests)
npm --prefix server run test:auth

# Run Loan Management test suite (11 tests)
npm --prefix server run test:loans
```

### Test Suite Coverage (29 Tests Total)

- **Authentication Suite (`server/src/tests/auth.test.ts` — 18 tests)**:
  - OTP generation and delivery without leaking codes in HTTP responses.
  - Server terminal logging validation.
  - Successful OTP verification and signed JWT generation.
  - Automatic user creation in PostgreSQL without duplicates on subsequent logins.
  - Incorrect OTP rejection and attempt counter decrementing.
  - Expired OTP rejection.
  - Replay attack prevention (single-use OTP consumption).
  - Rate limiting and maximum verification attempt lockout (HTTP 429).
  - JWT middleware authorization and rejection of missing, invalid, or expired tokens.
  - Health check endpoint availability.
  - Rejection of universal OTP `123456` when demo mode is disabled.
  - Demo OTP request with `demoMode: true` without disclosing codes in the response body.
  - Stateless demo verification with `123456` without requiring in-memory storage.
  - Profile retrieval on `/api/auth/me` using demo-issued JWT tokens.
  - Strict rejection of invalid phone formats in both demo and standard modes.
  - Demo abuse protection lockout after 5 consecutive failed attempts.
- **Loan API Suite (`server/src/tests/loans.test.ts` — 11 tests)**:
  - Rejection of unauthenticated requests (HTTP 401).
  - Valid loan creation with positive decimal amounts.
  - Input rejection for empty names, negative/zero amounts, or malformed dates.
  - Strict multi-tenant isolation: clients cannot create loans assigned to other users.
  - Filtered listing: users can only view their own loans.
  - Cross-user data isolation: users cannot inspect or repay another user's loan.
  - Repayment marking (`isRepaid = true`, immutable `repaidAt`).
  - Idempotent repayment handling.
  - Accurate aggregate calculations (`totalLent`, `totalRepaid`, `overdueAmount`).
  - Empty ledger handling (`0.00` totals).
  - Arbitrary precision decimal preservation (`0.10 + 0.20 + 999.99 = 1000.29`).

---

## Production Builds & Verification

Both the client and server compile into optimized production distributions:

```bash
# 1. Build and test backend
npm --prefix server run build     # Compiles TypeScript to server/dist/
npm --prefix server start         # Runs compiled server/dist/index.js

# 2. Build and preview frontend
npm --prefix client run build     # Type-checks and bundles static assets to client/dist/
npm --prefix client run preview   # Previews production frontend build locally
```

---

## Security Considerations & Limitations

MiniLedger was designed as a production-grade prototype. The following security considerations and limitations should be noted:

1. **Public Reviewer Demo vs. Real Production Authentication**:
   - **Public Reviewer Demo (`DEMO_OTP_ENABLED=true`)**: The fixed demo OTP (`123456`) is intentionally enabled for evaluation and demonstration only. It **does not verify phone-number ownership** and is **not suitable for real financial use or real customer data**.
   - **Real Production Authentication**: Real production deployments require disabling demo mode (`DEMO_OTP_ENABLED=false`) and implementing genuine phone-number verification via a commercial telecom SMS gateway (e.g., Twilio, AWS SNS) to confirm physical possession of the phone number.
2. **SMS Gateway Integration**:
   - Real SMS delivery via an external telecommunications provider is not currently configured in this codebase; verification codes are either printed to server terminal logs during local development or fixed to `123456` when demo mode is explicitly enabled.
3. **In-Memory State**:
   - In local development mode, OTP storage and rate-limiting counters are held in Node.js process memory.
   - In a multi-instance production environment, this should be replaced with a distributed cache such as Redis.
4. **Token Storage**:
   - JWT tokens are stored in browser `localStorage` for single-page application simplicity. In high-assurance production environments, tokens should be transmitted via `HttpOnly`, `Secure` cookies with CSRF defense.
5. **Data Isolation**:
   - Strict row-level tenant isolation is enforced at the API layer. All queries filter by `userId` extracted directly from the cryptographically verified JWT payload.
6. **Secret Management**:
   - Database credentials and JWT secrets are managed strictly through environment variables and excluded from Git.

---

## Future Roadmap

- Integration with a live SMS provider (e.g., Twilio, MessageBird, AWS SNS).
- Distributed rate-limiting and session caching using Redis.
- Installment schedules and partial repayment tracking.
- Multi-currency support and localized formatting.
- Receipt image uploads and attachment storage.
- Export ledger data to CSV and PDF formats.

---

## License

This project is licensed under the MIT License.
