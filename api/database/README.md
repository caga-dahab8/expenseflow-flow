# ExpenseFlow MongoDB migrations

## Setup

1. Copy `.env.example` to `.env`.
2. Add the MongoDB Atlas connection string to `MONGODB_URI`.
3. Set `MONGODB_DATABASE` if the database should not be named `expenseflow`.
4. In Atlas Network Access, allow the development machine's IP address.
5. Run `npm run db:migrate`.

## Commands

- `npm run db:status` shows applied and pending migrations.
- `npm run db:migrate` applies every pending migration.
- `npm run db:rollback` reverses the latest migration. The initial rollback drops all application collections and their data.

Migration state is recorded in the `_migrations` collection. Collection creation is idempotent: rerunning an interrupted initial migration updates validators and indexes before recording it as applied.

MongoDB does not enforce foreign keys. API services must verify referenced users, workspaces, accounts, and categories and must authorize workspace membership on every request.

## API development

Add a random `SESSION_SECRET` containing at least 32 characters to `.env`, then run:

```bash
npm run api:dev
```

The initial API exposes:

- `GET /api/health`
- `GET /api/health/database`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `GET /api/accounts`
- `POST /api/accounts`
- `PATCH /api/accounts/:id`
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/transactions/:id`
- `PATCH /api/transactions/:id`
- `DELETE /api/transactions/:id`

Authenticated workspace endpoints accept an optional `x-workspace-id` header. When it is omitted, the user's first active workspace is used. All reads and writes are scoped to the verified membership; owner, admin, and member roles can write while viewers are read-only.
