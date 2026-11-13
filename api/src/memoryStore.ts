// api/src/memoryStore.ts
import { randomUUID } from "crypto";
import { Expense, MemberId } from "./split";
import { Workspace, WorkspaceSummary } from "./store";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export class MemoryStore {
  private workspaces = new Map<string, Workspace>();
  private users = new Map<string, UserRecord>();
  private sessions = new Map<string, string>(); // tokenHash -> userId
  private access = new Map<string, Map<string, MemberId>>(); // workspaceId -> userId -> memberId
  private customCategories = new Map<string, Map<string, string>>(); // workspaceId -> normalized name -> display name

  async createWorkspace(name: string, memberIds: MemberId[]): Promise<Workspace> {
    const workspace: Workspace = { id: randomUUID(), name, memberIds: [...memberIds], expenses: [] };
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceSummary[]> {
    return Array.from(this.workspaces.values())
      .filter((workspace) => this.access.get(workspace.id)?.has(userId))
      .reverse()
      .map(({ id, name, memberIds }) => ({ id, name, memberIds: [...memberIds] }));
  }

  async addExpense(workspaceId: string, expense: Expense): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error("workspace not found");
    if (
      expense.sourceNotificationId &&
      workspace.expenses.some((item) => item.sourceNotificationId === expense.sourceNotificationId)
    ) return false;
    workspace.expenses.push(expense);
    return true;
  }

  async deleteExpense(workspaceId: string, expenseId: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return false;
    const index = workspace.expenses.findIndex((e) => e.id === expenseId);
    if (index === -1) return false;
    workspace.expenses.splice(index, 1);
    return true;
  }

  async listCustomCategories(workspaceId: string): Promise<string[]> {
    return Array.from(this.customCategories.get(workspaceId)?.values() ?? []);
  }

  async addCustomCategory(workspaceId: string, name: string): Promise<boolean> {
    if (!this.workspaces.has(workspaceId)) throw new Error("workspace not found");
    let categories = this.customCategories.get(workspaceId);
    if (!categories) {
      categories = new Map();
      this.customCategories.set(workspaceId, categories);
    }
    const key = name.trim().toLowerCase();
    if (categories.has(key)) return false;
    categories.set(key, name.trim());
    return true;
  }

  async addMember(workspaceId: string, memberId: MemberId): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) throw new Error("workspace not found");
    workspace.memberIds.push(memberId);
  }

  // ---- Authentication ----

  async createUser(email: string, passwordHash: string): Promise<UserRecord> {
    const user: UserRecord = { id: randomUUID(), email, passwordHash };
    this.users.set(user.id, user);
    return user;
  }

  async findUserByEmail(email: string): Promise<UserRecord | undefined> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return undefined;
  }

  async createSession(tokenHash: string, userId: string): Promise<void> {
    this.sessions.set(tokenHash, userId);
  }

  async findSessionUser(tokenHash: string): Promise<string | undefined> {
    return this.sessions.get(tokenHash);
  }

  async grantAccess(workspaceId: string, userId: string, memberId: MemberId): Promise<void> {
    let byUser = this.access.get(workspaceId);
    if (!byUser) {
      byUser = new Map();
      this.access.set(workspaceId, byUser);
    }
    byUser.set(userId, memberId);
  }

  async getMemberForUser(workspaceId: string, userId: string): Promise<MemberId | undefined> {
    return this.access.get(workspaceId)?.get(userId);
  }
}
