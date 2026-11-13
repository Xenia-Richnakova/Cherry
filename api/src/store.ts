// api/src/store.ts
import { Expense, MemberId } from "./split";

export interface Workspace {
  id: string;
  name: string;
  memberIds: MemberId[];
  expenses: Expense[];
}

export type WorkspaceSummary = Pick<Workspace, "id" | "name" | "memberIds">;
