# MiniLedger

MiniLedger is a clean, minimal personal finance application designed for tracking money lent to friends. It provides seamless phone-number OTP authentication, transparent ledger tracking, overdue loan highlighting, and real-time financial aggregate summaries with exact decimal precision.

---

## Key Features

- **Passwordless Phone OTP Authentication**: Log in securely using your phone number and a cryptographically generated 6-digit one-time password (OTP).
- **Interactive Loan Ledger**: Record loans with friend names, amounts, and scheduled due dates.
- **Overdue Recognition & Visual Alerts**: Automatically identifies past-due unpaid loans and emphasizes them with red styling and alert badges.
- **Instant Repayment Tracking**: Mark loans as repaid with a single click, recording an immutable repayment timestamp and dynamically refreshing metrics.
- **Real-Time Financial Metrics**: Instant calculation of **Total Lent**, **Total Repaid**, and **Overdue Amount** backed by database-level decimal arithmetic.
- **Search & Dynamic Filters**: Fast client-side filtering by status (`All`, `Pending`, `Overdue`, `Repaid`) and instant search by friend name.
- **Robust Multi-Tenant Security**: Strict user-level data isolation via JWT Bearer authentication; users can only view and mutate their own loans.

---

## Demo Login

MiniLedger currently supports demo OTP authentication, so you can test the application without receiving an SMS.

**How to log in:**
1. Open the MiniLedger website.
2. Enter your phone number, including the country code.
3. Click **Send One-Time Code**.
4. Enter the demo OTP: `123456`.
5. Click **Verify & Open Dashboard** to access the application.

**Note:** The demo OTP is intended for testing and demonstration purposes. Real SMS delivery is not currently configured.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS |
| **Backend** | Node.js (v18+ LTS / v20+), Express, TypeScript, tsx |
| **ORM & Database** | Prisma 6, PostgreSQL (Neon Serverless PostgreSQL) |
| **Authentication** | Stateless JWT (`jsonwebtoken`), in-memory rate-limited OTP engine |
| **Testing & Tooling** | Supertest, tsx, Node test assertions, ESLint-compatible TypeScript |
| **Package Manager** | npm |

---

## Architecture Summary

MiniLedger uses a lightweight monorepo architecture:

```text
miniledger/
├── client/                      # Frontend SPA
│   ├── src/
│   │   ├── components/          # UI Components (Navbar, SummaryCards, LoanList, AddLoanModal, etc.)
│   │   ├── services/api.ts      # Typed API client, token management & session handling
│   │   ├── types/index.ts       # Shared TypeScript models (Loan, User, LoanSummary)
│   │   ├── App.tsx              # Application root & authentication state machine
│   │   ├── main.tsx             # React DOM entry point
│   │   └── index.css            # Responsive modern financial dashboard styling
│   ├── .env.example             # Frontend environment template
│   ├── package.json
│   └── vite.config.ts
├── server/                      # Backend REST API
│   ├── prisma/
│   │   ├── migrations/          # Version-controlled SQL migration history
│   │   └── schema.prisma        # Database schema definitions (User, Loan)
│   ├── src/
│   │   ├── lib/prisma.ts        # Singleton Prisma client instance
│   │   ├── middleware/auth.ts   # JWT verification middleware (authenticateToken)
│   │   ├── routes/
│   │   │   ├── auth.ts          # /api/auth routes (request-otp, verify-otp, me)
│   │   │   └── loans.ts         # /api/loans routes (CRUD, repay, summary)
│   │   ├── services/otp.ts      # Cryptographic OTP generator, in-memory store & rate-limiter
│   │   ├── tests/               # Automated test suites (auth.test.ts, loans.test.ts)
│   │   └── index.ts             # Express app setup, JSON parsers, CORS & health check
│   ├── .env.example             # Backend environment template
│   ├── package.json
│   └── tsconfig.json
├── .gitignore                   # Excludes node_modules, build outputs, and all .env files
├── walkthrough.md               # Detailed phase reports & verification audit
└── README.md                    # Project documentation & reviewer guide
```

### Data Flow

```text
[ Browser (React SPA) ]
         │
         │ HTTP / JSON (Bearer JWT in Authorization header)
         ▼
[ Express API Server ]
    ├── Auth Middleware (Verifies JWT, extracts req.user.id)
    ├── Input Validation (E.164 phone, Decimal amounts, ISO dates)
    └── Prisma ORM
         │
         │ Parameterized SQL queries (WHERE "userId" = req.user.id)
         ▼
[ Neon PostgreSQL Database ]
    ├── User table (id, phone, createdAt)
    └── Loan table (id, userId, friendName, amount Decimal(12,2), dueDate, isRepaid, repaidAt)
```

---

## Prerequisites

Before starting, ensure you have the following installed on your machine:

- **Node.js**: Version 18.x or later (recommended: Node.js 20+ LTS or Node.js 22+)
- **npm**: Version 9.x or later
- **PostgreSQL Database**: A running PostgreSQL database instance (such as a free [Neon](https://neon.tech) cloud PostgreSQL database or local PostgreSQL 14+).

---

## Environment Variables Configuration

Both the frontend and backend require local environment files. Templates with safe placeholders are provided in `.env.example`.

### 1. Backend Configuration (`server/.env`)

Create `server/.env` by copying `server/.env.example`:

```bash
cd server
cp .env.example .env
```

Configure the following variables in `server/.env`:

```env
# Server listening port (default: 5001)
PORT=5001

# PostgreSQL connection string (Prisma)
# Example for local PostgreSQL:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/miniledger?schema=public"
# Example for Neon Serverless PostgreSQL:
DATABASE_URL="postgresql://user:password@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Strong secret key for signing authentication JWT tokens
JWT_SECRET="your-secure-random-jwt-secret-key-here"

# Demo OTP mode toggle (disabled by default, set to true for reviewer demo deployments)
DEMO_OTP_ENABLED=false
```

> **Security Note**: `server/.env` is strictly ignored by Git and must never be committed.

### 2. Frontend Configuration (`client/.env`)

Create `client/.env` by copying `client/.env.example`:

```bash
cd client
cp .env.example .env
```

Configure `client/.env`:

```env
# Base URL for the Express API server
VITE_API_BASE_URL=http://localhost:5001

# Demo OTP mode toggle (disabled by default, set to true for reviewer demo deployments)
VITE_DEMO_OTP_ENABLED=false
```

---

## Installation & Database Setup

### Step 1: Install Dependencies

From the repository root:

```bash
# Install frontend dependencies
cd client
npm install
cd ..

# Install backend dependencies
cd server
npm install
cd ..
```

### Step 2: Database Migration & Prisma Client Generation

With your `DATABASE_URL` configured in `server/.env`:

```bash
cd server

# Apply database migrations to PostgreSQL
npx prisma migrate deploy

# Generate the type-safe Prisma client
npx prisma generate

cd ..
```

*(Note: During local schema development, you can use `npx prisma migrate dev` if modifying `schema.prisma`.)*

---

## Running the Application in Development

### 1. Start the Backend API

```bash
cd server
npm run dev
```

The backend server starts on `http://localhost:5001` (or your configured `PORT`).

Verify the health check endpoint:
```bash
curl http://localhost:5001/api/health
```
Response:
```json
{
  "status": "ok",
  "message": "MiniLedger API is running",
  "timestamp": "..."
}
```

### 2. Start the Frontend Client

Open a second terminal window:

```bash
cd client
npm run dev
```

The Vite dev server will start at:
👉 **[http://localhost:5173](http://localhost:5173)**

Open `http://localhost:5173` in your web browser.

---

## How Mock OTP Authentication Works

MiniLedger uses a simulated SMS OTP flow tailored for development and testing without requiring third-party SMS gateway credentials (e.g. Twilio):

1. **User requests an OTP**: The user enters their phone number (e.g. `+1 202 555 0199`) in the web UI.
2. **Server generates OTP**: The backend validates the phone format, generates a cryptographically secure 6-digit random code, and caches it in memory with a 5-minute time-to-live (TTL).
3. **Delivery via Terminal Console**: The backend logs the generated code directly to the active terminal:
   ```text
   [AUTH] Generated OTP for +12025550199: 849201
   ```
4. **Security Enforcement**: The OTP is **never returned in the HTTP response**.
5. **Verification & Login**: The user reads the code from the terminal, types it into the web UI, and clicks **Verify & Login**.
6. **JWT Issuance**: Upon successful verification, the backend upserts the user in PostgreSQL and issues a signed JWT token. The frontend stores this token in browser `localStorage` and includes it as `Authorization: Bearer <token>` on all future requests.

---

## Running Automated Tests

MiniLedger includes an automated test suite covering authentication, security edge cases, loan business rules, and decimal calculation integrity.

Run the test suite from the repository root:

```bash
npm --prefix server run test
```

Or from inside `server/`:

```bash
cd server
npm run test
```

### Test Coverage Highlights (29 Tests Total)

- **Authentication Suite (`auth.test.ts` — 18 tests)**:
  - OTP request success without leaking OTP in response.
  - Server console OTP logging validation.
  - Correct OTP verification & token generation.
  - Automatic user creation in PostgreSQL without duplicate records on re-login.
  - Incorrect OTP rejection & single-use OTP invalidation (cannot reuse consumed OTP).
  - Attempt rate-limiting protection.
  - JWT middleware token validation and rejection of invalid/expired tokens.
  - API health check stability.
  - Rejection of universal OTP `123456` when demo mode is disabled.
  - Demo OTP request and verification with `123456` without requiring in-memory storage (serverless-compatible).
  - Verification of demo-generated JWT against `/api/auth/me`.
  - Strict rejection of invalid phone numbers in both demo and standard modes.
  - Demo verification abuse protection (5-attempt lockout).
- **Loan API Suite (`loans.test.ts` — 11 tests)**:
  - Unauthenticated access rejection (401).
  - Loan creation with valid friend name, decimal amount, and due date.
  - Input rejection for empty names, negative amounts, or malformed dates.
  - User isolation: prevention of cross-user data leakage or unauthorized repayment.
  - Loan repayment marking (`isRepaid = true`, immutable `repaidAt`).
  - Idempotent repayment handling.
  - Financial summary aggregation (`totalLent`, `totalRepaid`, `overdueAmount`).
  - Empty ledger handling (`0.00` totals).
  - Exact decimal precision preservation without floating-point drift (`0.10 + 0.20 + 999.99 = 1000.29`).

---

## Production Builds

Both frontend and backend compile to standalone production builds:

```bash
# Build backend
cd server
npm run build
# Generated artifacts in server/dist/

# Test backend production execution
npm start

# Build frontend
cd ../client
npm run build
# Generated optimized static bundle in client/dist/

# Preview production frontend build
npm run preview
```

---

## Reviewer Demo Walkthrough (Step-by-Step)

Follow this 5-minute walkthrough to verify the complete MiniLedger MVP:

1. **Launch Services**:
   - Terminal 1: `cd server && npm run dev`
   - Terminal 2: `cd client && npm run dev`
2. **Access Application**:
   - Open [http://localhost:5173](http://localhost:5173).
3. **Log In with Mock OTP**:
   - Enter any valid phone number (e.g. `+1 202 555 0199`) and click **Send OTP**.
   - Check Terminal 1 for `[AUTH] Generated OTP for +12025550199: XXXXXX`.
   - Enter the 6-digit code into the UI and click **Verify & Login**.
4. **Observe Empty Ledger**:
   - Notice the initial dashboard state: **Total Lent: $0.00**, **Total Repaid: $0.00**, **Overdue: $0.00**, with the empty ledger graphic.
5. **Record a Future Loan**:
   - Click **+ Add Loan**.
   - Enter Friend Name: `Alice`, Amount: `150.00`, Due Date: (any future date, e.g. next month).
   - Click **Save Loan**.
   - Summary updates immediately: **Total Lent: $150.00**, **Overdue: $0.00**.
6. **Record an Overdue Loan**:
   - Click **+ Add Loan**.
   - Enter Friend Name: `Bob`, Amount: `75.50`, Due Date: (any past date, e.g. last week).
   - Click **Save Loan**.
   - Notice Bob's row is highlighted with a red badge and alert styling.
   - Summary updates immediately: **Total Lent: $225.50**, **Overdue: $75.50**.
7. **Mark Overdue Loan as Repaid**:
   - In Bob's row, click **Mark Repaid**.
   - Bob's status changes to `Repaid`.
   - Summary updates in real time: **Overdue Amount drops to $0.00**, and **Total Repaid becomes $75.50**.
8. **Test Dynamic Filters & Search**:
   - Type `Alice` into the search box: only Alice's record is displayed.
   - Click filter pill **Repaid**: only Bob's repaid record is displayed.
   - Click filter pill **Pending**: only Alice's pending loan is displayed.
9. **Verify Session Restoration & Sign Out**:
   - Refresh the browser (`Cmd+R` / `F5`). The session and ledger persist automatically via `GET /api/auth/me`.
   - Click **Sign Out** in the navigation header. The JWT is erased from `localStorage` and the view returns to the Login screen.

---

## Known Limitations & Future Roadmap

1. **Mock OTP Delivery**:
   - *Current Implementation*: For local evaluation and automated testing, OTPs are printed to the backend terminal console and stored in memory with TTL expiration.
   - *Production Roadmap*: In a commercial deployment, integrate a third-party SMS provider (e.g., Twilio or AWS SNS) and back the OTP cache with a Redis cluster.
2. **In-Memory Rate Limiting**:
   - *Current Implementation*: Authentication attempt rate-limiting is held in backend Node process memory.
   - *Production Roadmap*: Use distributed Redis rate-limiting (e.g., sliding window via Redis) to support multi-instance backend clusters.
3. **Manual Browser & Viewport Verification**:
   - The UI is designed with modern responsive CSS flexbox/grid layout and tested for standard desktop and tablet viewports. Detailed physical mobile device testing across older browser versions (e.g. Safari iOS 15) remains a manual review step.
4. **Receipts & Multi-Currency**:
   - MiniLedger MVP operates on a single base currency format (`$`). Support for multi-currency loans, partial installment payments, and receipt attachment uploads are planned for future versions.

---

## Implementation Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Project Setup, Monorepo Architecture & Express Health Check | ✅ Complete |
| **Phase 2** | Database Configuration, Neon PostgreSQL & Prisma Models | ✅ Complete |
| **Phase 3** | Phone OTP Authentication, JWT Middleware & Unit Tests | ✅ Complete |
| **Phase 4** | Loan Management REST APIs, Decimal Arithmetic & Test Suite | ✅ Complete |
| **Phase 5** | React Frontend UI, Component Hierarchy & Design Styling | ✅ Complete |
| **Phase 6** | Frontend–Backend Integration, Live State & Session Persistence | ✅ Complete |
| **Phase 7** | Full MVP Verification, Edge-Case Stabilization & Security Audit | ✅ Complete |
| **Phase 8** | Submission Preparation, Documentation, Cleanup & Demo Plan | ✅ Complete |

---

## License

This project is licensed under the MIT License.
