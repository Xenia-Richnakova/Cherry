// api/src/server.ts
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { computeBalances, settleUp, Expense, MemberId } from "./split";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from "./errors";
import { Workspace, WorkspaceSummary } from "./store";
import { hashPassword, verifyPassword, newSessionToken, hashToken } from "./auth";
import { registerBankNotificationRoutes } from "./features/bank-notifications";

// Any object with these methods can back the API: MemoryStore for tests,
// PostgresStore in production.
export interface WorkspaceStore {
  createWorkspace(name: string, memberIds: MemberId[]): Promise<Workspace>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  addExpense(workspaceId: string, expense: Expense): Promise<boolean | void>;
  deleteExpense(workspaceId: string, expenseId: string): Promise<boolean>;
  listCustomCategories(workspaceId: string): Promise<string[]>;
  addCustomCategory(workspaceId: string, name: string): Promise<boolean>;
  addMember(workspaceId: string, memberId: MemberId, displayName: string): Promise<void>;
  createUser(email: string, passwordHash: string): Promise<{ id: string; email: string }>;
  findUserByEmail(
    email: string
  ): Promise<{ id: string; email: string; passwordHash: string } | undefined>;
  createSession(tokenHash: string, userId: string): Promise<void>;
  findSessionUser(tokenHash: string): Promise<string | undefined>;
  grantAccess(workspaceId: string, userId: string, memberId: MemberId): Promise<void>;
  getMemberForUser(workspaceId: string, userId: string): Promise<MemberId | undefined>;
}

// Attached to the request after authentication succeeds.
interface AuthedRequest extends Request {
  userId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

const DEFAULT_EXPENSE_CATEGORIES = [
  "Groceries",
  "Fuel",
  "Restaurants",
  "Cosmetics",
  "Clothes",
  "Hygiene",
  "Unknown",
];

function categoryKey(value: string): string {
  return value.trim().toLowerCase();
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normaliseExpenseDate(value: unknown): string {
  if (value === undefined || value === null || value === "") return localDateString();
  if (typeof value !== "string") throw new ValidationError("date must use YYYY-MM-DD format");
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new ValidationError("date must use YYYY-MM-DD format");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new ValidationError("date is not a valid calendar date");
  }
  return value;
}

function paramId(value: string | string[] | undefined): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError("workspace id is required");
  }
  return value;
}

// Trims each ID and rejects blanks and duplicates, including duplicates that
// differ only by surrounding whitespace.
function normaliseMemberIds(value: unknown): MemberId[] {
  if (!isStringArray(value) || value.length === 0) {
    throw new ValidationError("memberIds must be a non-empty array of strings");
  }
  const trimmed = value.map((id) => id.trim());
  if (new Set(trimmed).size !== trimmed.length) {
    throw new ValidationError("memberIds must be unique");
  }
  return trimmed;
}

// Basic email shape check. Full validation is out of scope for this step.
function normaliseEmail(value: unknown): string {
  if (!isNonEmptyString(value)) throw new ValidationError("email is required");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("email is not valid");
  }
  return email;
}

function normalisePassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 8) {
    throw new ValidationError("password must be at least 8 characters");
  }
  return value;
}

// Wrap async handlers so rejected promises reach the error middleware.
const wrap =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function createApp(store: WorkspaceStore) {
  const app = express();
  app.use(express.json());

  // Lets a browser on another origin (such as index.html opened from disk)
  // send JSON requests. Expo Go is not affected by CORS.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Reads "Authorization: Bearer <token>", finds the session and attaches the user.
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) {
      next(new UnauthorizedError("authentication required"));
      return;
    }

    store
      .findSessionUser(hashToken(match[1]))
      .then((userId) => {
        if (!userId) {
          next(new UnauthorizedError("invalid or expired session"));
          return;
        }

        (req as AuthedRequest).userId = userId;
        next();
      })
      .catch(next);
  };

  // Confirms the signed-in user belongs to the workspace in the URL. Runs after
  // requireAuth. Returns the workspace so handlers do not load it twice.
  async function requireWorkspaceAccess(req: Request): Promise<Workspace> {
    const userId = (req as AuthedRequest).userId;
    if (!userId) throw new UnauthorizedError("authentication required");

    const workspaceId = paramId(req.params.id);
    const workspace = await store.getWorkspace(workspaceId);
    if (!workspace) throw new NotFoundError("workspace not found");

    const memberId = await store.getMemberForUser(workspaceId, userId);
    if (!memberId) throw new ForbiddenError("you are not a member of this workspace");

    return workspace;
  }

  registerBankNotificationRoutes(
    app,
    requireAuth,
    requireWorkspaceAccess,
    store,
    (req) => (req as AuthedRequest).userId
  );

  // ---- Authentication routes (public) ----

  app.post(
    "/auth/register",
    wrap(async (req, res) => {
      const email = normaliseEmail(req.body?.email);
      const password = normalisePassword(req.body?.password);

      if (await store.findUserByEmail(email)) {
        throw new ConflictError("an account with this email already exists");
      }

      const user = await store.createUser(email, await hashPassword(password));
      res.status(201).json({ id: user.id, email: user.email });
    })
  );

  app.post(
    "/auth/login",
    wrap(async (req, res) => {
      const email = normaliseEmail(req.body?.email);
      const password = typeof req.body?.password === "string" ? req.body.password : "";

      const user = await store.findUserByEmail(email);
      // Same message whether the email or the password is wrong, so the API
      // does not reveal which accounts exist.
      const ok = user !== undefined && (await verifyPassword(password, user.passwordHash));
      if (!ok || !user) throw new UnauthorizedError("invalid email or password");

      const token = newSessionToken();
      await store.createSession(hashToken(token), user.id);
      // The token is returned once. The server keeps only its hash.
      res.status(200).json({ token, userId: user.id });
    })
  );

  // ---- Workspace routes (all require a valid session) ----

  app.get(
    "/workspaces",
    requireAuth,
    wrap(async (req, res) => {
      const userId = (req as AuthedRequest).userId as string;
      const workspaces = await store.listWorkspacesForUser(userId);
      res.json({ workspaces });
    })
  );

  app.post(
    "/workspaces",
    requireAuth,
    wrap(async (req, res) => {
      const userId = (req as AuthedRequest).userId as string;
      const { name, memberIds, yourMemberId } = req.body ?? {};
      if (!isNonEmptyString(name)) throw new ValidationError("name is required");
      const members = normaliseMemberIds(memberIds);

      // The creator must choose which member they are, so they can access the workspace.
      if (!isNonEmptyString(yourMemberId) || !members.includes(yourMemberId.trim())) {
        throw new ValidationError("yourMemberId must be one of memberIds");
      }

      const workspace = await store.createWorkspace(name, members);
      await store.grantAccess(workspace.id, userId, yourMemberId.trim());
      res.status(201).json(workspace);
    })
  );

  app.get(
    "/workspaces/:id/categories",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      const custom = await store.listCustomCategories(workspace.id);
      res.json({ categories: [...DEFAULT_EXPENSE_CATEGORIES, ...custom] });
    })
  );

  app.post(
    "/workspaces/:id/categories",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      const { name } = req.body ?? {};
      if (!isNonEmptyString(name) || name.trim().length > 40) {
        throw new ValidationError("category name must be between 1 and 40 characters");
      }

      const trimmedName = name.trim();
      const existing = [
        ...DEFAULT_EXPENSE_CATEGORIES,
        ...(await store.listCustomCategories(workspace.id)),
      ];
      if (existing.some((category) => categoryKey(category) === categoryKey(trimmedName))) {
        throw new ConflictError("that category already exists");
      }

      const added = await store.addCustomCategory(workspace.id, trimmedName);
      if (!added) throw new ConflictError("that category already exists");
      res.status(201).json({ category: trimmedName });
    })
  );

  // Add a shadow member (someone without an account) to an existing workspace.
  app.post(
    "/workspaces/:id/members",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);

      const { name } = req.body ?? {};
      if (!isNonEmptyString(name)) throw new ValidationError("name is required");
      const memberId = name.trim();

      if (workspace.memberIds.includes(memberId)) {
        throw new ConflictError("a member with this name already exists");
      }

      await store.addMember(workspace.id, memberId, memberId);
      res.status(201).json({ memberId, name: memberId });
    })
  );

  app.post(
    "/workspaces/:id/expenses",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);

      const { payerId, amountCents, participantIds, description, category, date, note } = req.body ?? {};
      if (!isNonEmptyString(payerId)) throw new ValidationError("payerId is required");
      if (category !== undefined && !isNonEmptyString(category)) {
        throw new ValidationError("category must be a non-empty string");
      }
      if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
        throw new ValidationError("amountCents must be a positive integer (money in cents)");
      }
      if (!isStringArray(participantIds) || participantIds.length === 0) {
        throw new ValidationError("participantIds must be a non-empty array of strings");
      }
      if (note !== undefined && typeof note !== "string") {
        throw new ValidationError("note must be a string");
      }
      if (typeof note === "string" && note.trim().length > 500) {
        throw new ValidationError("note must be 500 characters or fewer");
      }

      let selectedCategory: string | undefined;
      if (category !== undefined) {
        const availableCategories = [
          ...DEFAULT_EXPENSE_CATEGORIES,
          ...(await store.listCustomCategories(workspace.id)),
        ];
        selectedCategory = availableCategories.find(
          (available) => categoryKey(available) === categoryKey(category)
        );
        if (!selectedCategory) {
          throw new ValidationError("category is not available in this workspace");
        }
      }

      const expense: Expense = {
        id: randomUUID(),
        payerId: payerId.trim(),
        amountCents,
        participantIds: participantIds.map((id) => id.trim()),
        category: selectedCategory,
        date: normaliseExpenseDate(date),
        note: typeof note === "string" && note.trim() ? note.trim() : undefined,
        description: typeof description === "string" && description.trim() ? description.trim() : undefined,
      };

      // Validate members before saving. computeBalances throws if a payer or
      // participant is not a member; the database foreign keys also enforce this.
      computeBalances(workspace.memberIds, [...workspace.expenses, expense]);

      const inserted = await store.addExpense(workspace.id, expense);
      if (expense.sourceNotificationId && inserted === false) {
        res.status(200).json({ alreadyImported: true });
        return;
      }
      res.status(201).json(expense);
    })
  );

  app.get(
    "/workspaces/:id/expenses",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      res.json({ expenses: workspace.expenses });
    })
  );

  app.delete(
    "/workspaces/:id/expenses/:expenseId",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      const expenseId = paramId(req.params.expenseId);

      const deleted = await store.deleteExpense(workspace.id, expenseId);
      if (!deleted) throw new NotFoundError("expense not found");

      res.status(204).end();
    })
  );

  app.get(
    "/workspaces/:id/balances",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      res.json({ balances: computeBalances(workspace.memberIds, workspace.expenses) });
    })
  );

  app.get(
    "/workspaces/:id/settle-up",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await requireWorkspaceAccess(req);
      const balances = computeBalances(workspace.memberIds, workspace.expenses);
      res.json({ settlements: settleUp(balances) });
    })
  );

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
    } else if (err instanceof UnauthorizedError) {
      res.status(401).json({ error: err.message });
    } else if (err instanceof ForbiddenError) {
      res.status(403).json({ error: err.message });
    } else if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
    } else if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message });
    } else if (err.message.includes("is not a workspace member")) {
      res.status(400).json({ error: err.message });
    } else {
      console.error(err);
      res.status(500).json({ error: "internal server error" });
    }
  });

  return app;
}

if (require.main === module) {
  // Requires a running PostgreSQL. See the setup notes below.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Pool } = require("pg");
  const { PostgresStore } = require("./postgresStore");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const port = Number(process.env.PORT ?? 3000);
  async function start() {
    await pool.query("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS category TEXT");
    await pool.query("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE");
    await pool.query("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS note TEXT");
    await pool.query("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_notification_id TEXT");
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_notification
      ON expenses (workspace_id, source_notification_id) WHERE source_notification_id IS NOT NULL`);
    await pool.query("UPDATE expenses SET expense_date = CURRENT_DATE WHERE expense_date IS NULL");
    await pool.query("ALTER TABLE expenses ALTER COLUMN expense_date SET DEFAULT CURRENT_DATE");
    await pool.query("ALTER TABLE expenses ALTER COLUMN expense_date SET NOT NULL");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_categories (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        category_key TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (workspace_id, category_key)
      )
    `);
    createApp(new PostgresStore(pool)).listen(port, () => {
      console.log(`Cherry API listening on http://localhost:${port}`);
    });
  }
  start().catch((err: Error) => {
    console.error("Could not initialize the database schema:", err.message);
    process.exitCode = 1;
  });
}
