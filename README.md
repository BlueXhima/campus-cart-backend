# Campus Cart — School Merchandise and Bookstore Reserved-and-Pickup System

Campus Cart is an ITEC 116 Systems Integration Backend Prototype. Students can browse school merchandise and create cash-on-pickup reservations, while staff manage the catalog inventory and order pickup lifecycle.

## Tech Stack

- NestJS with TypeScript
- TypeORM with MySQL (`mysql2`)
- JWT authentication (`@nestjs/jwt`, `passport-jwt`)
- `bcrypt` for password hashing
- `class-validator` and `class-transformer` for request validation and serialization

## Prerequisites

- Node.js v18 or later
- npm
- MySQL Server (for example, through XAMPP or MySQL Workbench)

## Local Setup

1. Clone this repository and install dependencies:

   ```bash
   git clone <repository-url>
   cd campus-cart-backend
   npm install
   ```

2. Copy `.env.example` to `.env` (in PowerShell, run `Copy-Item .env.example .env`) and configure your MySQL credentials and a strong `JWT_SECRET`.

3. Create an empty MySQL database named `campus_cart`. TypeORM synchronizes the five entity tables when the application starts.

## Running the Application

Development:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

The base API URL is `http://localhost:3000/api/v1`.

## API Modules and Quick Start

The API has 23 functional endpoints across five modules:

- **Auth** — registration, login, and the authenticated user profile.
- **Users** — user listing, lookup, update, and removal.
- **Categories** — category creation and catalog management.
- **Products** — product listing and inventory management.
- **Orders and OrderItems** — reservation creation, order retrieval, item lookup, status updates, and cancellation.

To create a prototype test account, send a request to `POST /api/v1/auth/register`. Omitting `role` creates a `Student` account; supplying `"role": "Staff"` creates a Staff administrator account for prototype testing. Allowing public role selection is intended for this prototype only and should be restricted before production use.

Authenticate with `POST /api/v1/auth/login` using the account credentials. Use the returned access token as a Bearer token for protected endpoints.
