// api/src/store.ts
import { Expense, MemberId } from "./split";

export interface Workspace {
  id: string;
  name: string;
  memberIds: MemberId[];
  expenses: Expense[];
}