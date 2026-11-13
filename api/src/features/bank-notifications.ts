import { randomUUID } from "crypto";
import { Express, NextFunction, Request, RequestHandler, Response } from "express";
import { Expense } from "../split";
import { Workspace } from "../store";
import { ForbiddenError, ValidationError } from "../errors";

interface BankNotificationStore {
  getMemberForUser(workspaceId: string, userId: string): Promise<string | undefined>;
  addExpense(workspaceId: string, expense: Expense): Promise<boolean | void>;
}

interface AuthedRequest extends Request {
  userId?: string;
}

const wrap =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };

function normaliseDate(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ValidationError("date must use YYYY-MM-DD format");
  }
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    year < 1 || check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day
  ) throw new ValidationError("date is not a valid calendar date");
  return value;
}

export function registerBankNotificationRoutes(
  app: Express,
  requireAuth: RequestHandler,
  getWorkspace: (req: Request) => Promise<Workspace>,
  store: BankNotificationStore,
  getUserId: (req: Request) => string | undefined
): void {
  app.post(
    "/workspaces/:id/bank-notifications/expenses",
    requireAuth,
    wrap(async (req, res) => {
      const workspace = await getWorkspace(req);
      const userId = getUserId(req);
      if (!userId) throw new ForbiddenError("you are not a member of this workspace");
      const payerId = await store.getMemberForUser(workspace.id, userId);
      const { notificationId, amountCents, date, note } = req.body ?? {};
      if (typeof notificationId !== "string" || !notificationId.trim() || notificationId.trim().length > 200) {
        throw new ValidationError("notificationId must be a non-empty string");
      }
      if (typeof amountCents !== "number" || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new ValidationError("amountCents must be a positive integer");
      }
      if (note !== undefined && (typeof note !== "string" || note.length > 160)) {
        throw new ValidationError("note must be 160 characters or fewer");
      }
      if (!payerId) throw new ForbiddenError("you are not a member of this workspace");

      const expense: Expense = {
        id: randomUUID(),
        payerId,
        amountCents,
        participantIds: [...workspace.memberIds],
        category: "Unknown",
        date: normaliseDate(date),
        note: typeof note === "string" && note.trim() ? note.trim() : "Tatra banka card payment",
        sourceNotificationId: notificationId.trim(),
      };
      const inserted = await store.addExpense(workspace.id, expense);
      if (inserted === false) {
        res.status(200).json({ alreadyImported: true });
        return;
      }
      res.status(201).json(expense);
    })
  );
}
