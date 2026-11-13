// api/src/postgresStore.ts
import { randomUUID } from "crypto";
import { Pool, PoolClient } from "pg";
import { Expense, MemberId } from "./split";
import { Workspace } from "./store";
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
      `SELECT e.id, e.payer_id, e.amount_cents,
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
    }));

    return {
      id: ws.rows[0].id,
      name: ws.rows[0].name,
      memberIds: members.rows.map((r) => r.member_id),
      expenses,
    };
  }

  async addExpense(workspaceId: string, expense: Expense): Promise<void> {
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query("SELECT 1 FROM workspaces WHERE id = $1", [workspaceId]);
      if (exists.rowCount === 0) throw new NotFoundError("workspace not found");

      await client.query(
        "INSERT INTO expenses (id, workspace_id, payer_id, amount_cents) VALUES ($1, $2, $3, $4)",
        [expense.id, workspaceId, expense.payerId, expense.amountCents]
      );
      for (const memberId of expense.participantIds) {
        await client.query(
          "INSERT INTO expense_participants (expense_id, workspace_id, member_id) VALUES ($1, $2, $3)",
          [expense.id, workspaceId, memberId]
        );
      }
      await client.query("COMMIT");
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