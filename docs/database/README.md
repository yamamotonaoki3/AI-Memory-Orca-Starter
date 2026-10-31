# M1 Database Design Starter v0.1

Based on long-term AI memory requirements v8.8 (Q1-Q86). **Design draft**; not a production-ready application.

## Files

- `DESIGN.md`: Japanese DB design, ER diagram, schema table guide, acceptance checks
- `er.mmd`: Mermaid ER diagram
- `schema.ts`: Drizzle SQLite core tables and indexes (27 tables)
- `drizzle.config.ts`: **development-only** sample Drizzle Kit configuration
- `fts5_search.sql`: FTS5 trigram virtual table and triggers
- `integrity_guardrails.sql`: immutable original/human revisions and safety publication guards
- `sqlite_smoke_test.py`: Python stdlib smoke tests of FTS and trigger guards

## First verification

```bash
python sqlite_smoke_test.py
```

Before TypeScript compilation, install and pin `drizzle-orm` and `drizzle-kit` in your application project. These files have **not** been checked against an installed Drizzle package; syntax alone has been parsed with TypeScript.

Review the generated migration SQL, then apply in a **new empty dev database**, never to your existing production data. The custom SQL is applied only after the core tables are in place. Do not run `drizzle-kit push` or automatically apply migrations at production server startup.

## Critical limitations before first real data

- WebAuthn authentication, Zod input validation, security scanner, complete state constraints, backup+restore and filesystem journaling are **not implemented** by this package.
- Do not insert real sensitive records until those components are built and validated.
- The `search_documents` publish guard is defense-in-depth, not a substitute for application user/project authorization.
- `integrity_guardrails.sql` blocks deletion of core original/revision metadata; the exceptional permanent-delete workflow requires a reviewed separate service and retained tombstones.
- Recovery ledger must have an independent trusted copy; merely recording its hash in the same SQLite file cannot prevent rollback.
