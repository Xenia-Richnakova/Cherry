// api/src/store.ts
import { Expense, MemberId } from "./split";

export interface ExpenseInvoiceAttachment {
  fileName: string;
  mimeType: string;
  data: Buffer;
}

export interface Workspace {
  id: string;
  name: string;
  memberIds: MemberId[];
  expenses: Expense[];
}

export type WorkspaceSummary = Pick<Workspace, "id" | "name" | "memberIds">;
