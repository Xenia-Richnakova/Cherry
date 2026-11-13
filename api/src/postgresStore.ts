// api/src/postgresStore.ts
import { randomUUID } from "crypto";
import { Pool, PoolClient } from "pg";
import { Expense, MemberId } from "./split";
import { Workspace, WorkspaceSummary } from "./store";
import { NotFoundError } from "./errors";
import { UserRecord } from "./memoryStore";

export class PostgresStore {
  constructor(private pool: Pool) {}

  async createWorkspace(name: string, memberIds: MemberId[]): Promise<Workspace> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const id = randomUUID();
      await client.query("INSERT INTO workspaces (id, name) VALUES ($1, $2)", [id, name]);
      for (const memberId of memberIds) {
        await client.query(
          "INSERT INTO workspace_members (workspace_id, member_id) VALUES ($1, $2)",
          [id, memberId]
        );
      }
      await client.query("COMMIT");
      return { id, name, memberIds: [...memberIds], expenses: [] };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const ws = await this.pool.query("SELECT id, name FROM workspaces WHERE id = $1", [id]);
    if (ws.rowCount === 0) return undefined;

    const members = await this.pool.query(
      "SELECT member_id FROM workspace_members WHERE workspace_id = $1 ORDER BY member_id",
      [id]
    );

    const expenseRows = await this.pool.query(
      `SELECT e.id, e.payer_id, e.amount_cents, e.description, e.category,
              e.expense_date, e.note, e.source_notification_id,
              COALESCE(array_agg(p.member_id ORDER BY p.member_id)
                       FILTER (WHERE p.member_id IS NOT NULL), '{}') AS participants
         FROM expenses e
         LEFT JOIN expense_participants p ON p.expense_id = e.id
        WHERE e.workspace_id = $1
        GROUP BY e.id, e.created_at
        ORDER BY e.created_at, e.id`,
      [id]
    );

    const expenses: Expense[] = expenseRows.rows.map((row) => ({
      id: row.id,
      payerId: row.payer_id,
      amountCents: row.amount_cents,
      participantIds: row.participants,
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      // node-postgres parses DATE columns as JavaScript Date objects. Keep the
      // API's date-only contract so mobile date parsing and date-window filters
      // do not hide saved expenses after a workspace reload.
      date: row.expense_date instanceof Date
        ? `${row.expense_date.getFullYear()}-${String(row.expense_date.getMonth() + 1).padStart(2, "0")}-${String(row.expense_date.getDate()).padStart(2, "0")}`
        : String(row.expense_date).slice(0, 10),
      note: row.note ?? undefined,
      sourceNotificationId: row.source_notification_id ?? undefined,
    }));

    return {
      id: ws.rows[0].id,
      name: ws.rows[0].name,
      memberIds: members.rows.map((r) => r.member_id),
      expenses,
    };
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
    const result = await this.pool.query(
      `SELECT w.id, w.name,
              array_agg(wm.member_id ORDER BY wm.member_id) AS member_ids
         FROM workspace_access wa
         JOIN workspaces w ON w.id = wa.workspace_id
         JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wa.user_id = $1
        GROUP BY w.id, w.name, w.created_at
        ORDER BY w.created_at DESC, w.id DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      memberIds: row.member_ids,
    }));
  }

  async addExpense(workspaceId: string, expense: Expense): Promise<boolean> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query("SELECT 1 FROM workspaces WHERE id = $1", [workspaceId]);
      if (exists.rowCount === 0) throw new NotFoundError("workspace not found");

      const inserted = await client.query(
        `INSERT INTO expenses
           (id, workspace_id, payer_id, amount_cents, description, category, expense_date, note, source_notification_id)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9)
         ON CONFLICT (workspace_id, source_notification_id) WHERE source_notification_id IS NOT NULL
         DO NOTHING RETURNING id`,
        [
          expense.id,
          workspaceId,
          expense.payerId,
          expense.amountCents,
          expense.description ?? null,
          expense.category ?? null,
          expense.date ?? null,
          expense.note ?? null,
          expense.sourceNotificationId ?? null,
        ]
      );
      if (inserted.rowCount === 0) {
        await client.query("COMMIT");
        return false;
      }
      for (const memberId of expense.participantIds) {
        await client.query(
          "INSERT INTO expense_participants (expense_id, workspace_id, member_id) VALUES ($1, $2, $3)",
          [expense.id, workspaceId, memberId]
        );
      }
      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  // Returns true if an expense was removed. The expense_participants rows are
  // removed automatically by ON DELETE CASCADE in schema.sql.
  async deleteExpense(workspaceId: string, expenseId: string): Promise<boolean> {
    const result = await this.pool.query(
      "DELETE FROM expenses WHERE id = $1 AND workspace_id = $2",
      [expenseId, workspaceId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async updateExpense(workspaceId: string, expense: Expense): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE expenses
          SET amount_cents = $3, expense_date = $4::date, category = $5, note = $6
        WHERE workspace_id = $1 AND id = $2`,
      [workspaceId, expense.id, expense.amountCents, expense.date, expense.category ?? null, expense.note ?? null]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async listCustomCategories(workspaceId: string): Promise<string[]> {
    const result = await this.pool.query(
      "SELECT name FROM workspace_categories WHERE workspace_id = $1 ORDER BY created_at, name",
      [workspaceId]
    );
    return result.rows.map((row) => row.name);
  }

  async addCustomCategory(workspaceId: string, name: string): Promise<boolean> {
    const result = await this.pool.query(
      `INSERT INTO workspace_categories (workspace_id, category_key, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, category_key) DO NOTHING
       RETURNING name`,
      [workspaceId, name.trim().toLowerCase(), name.trim()]
    );
    return result.rowCount === 1;
  }

  // displayName is accepted to match the store interface; the schema has no
  // display-name column yet.
  async addMember(workspaceId: string, memberId: MemberId, _displayName: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO workspace_members (workspace_id, member_id) VALUES ($1, $2)",
      [workspaceId, memberId]
    );
  }

  // ---- Authentication ----

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const id = randomUUID();
    await this.pool.query(
      "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
      [id, email, passwordHash]
    );
    return { id, email, passwordHash };
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    const result = await this.pool.query(
      "SELECT id, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    if (result.rowCount === 0) return undefined;
    const row = result.rows[0];
    return { id: row.id, email: row.email, passwordHash: row.password_hash };
  }

  async createSession(tokenHash: string, userId: string): Promise<void> {
    await this.pool.query(
      "INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)",
      [tokenHash, userId]
    );
  }

  async findSessionUser(tokenHash: string): Promise<string | undefined> {
    const result = await this.pool.query(
      "SELECT user_id FROM sessions WHERE token_hash = $1",
      [tokenHash]
    );
    return result.rowCount === 0 ? undefined : result.rows[0].user_id;
  }

  async grantAccess(workspaceId: string, userId: string, memberId: MemberId): Promise<void> {
    await this.pool.query(
      `INSERT INTO workspace_access (workspace_id, member_id, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET member_id = EXCLUDED.member_id`,
      [workspaceId, memberId, userId]
    );
  }

  async getMemberForUser(workspaceId: string, userId: string): Promise<MemberId | undefined> {
    const result = await this.pool.query(
      "SELECT member_id FROM workspace_access WHERE workspace_id = $1 AND user_id = $2",
      [workspaceId, userId]
    );
    return result.rowCount === 0 ? undefined : result.rows[0].member_id;
  }
}
