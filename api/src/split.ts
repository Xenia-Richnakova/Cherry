export type MemberId = string;

export interface Expense {
  id: string;
  payerId: MemberId;
  amountCents: number;
  participantIds: MemberId[];
  description?: string;
  category?: string;
  date?: string;
  note?: string;
}

export interface Balance {
  memberId: MemberId;
  balanceCents: number; // positive = is owed money, negative = owes money
}

export interface Settlement {
  fromId: MemberId; // pays
  toId: MemberId;   // receives
  amountCents: number;
}

/**
 * Splits an amount equally into integer cents.
 * Leftover cents go to the first participants so the shares add up exactly.
 * Example: 100 cents among 3 people -> [34, 33, 33].
 */
export function splitEqually(amountCents: number, participantIds: MemberId[]): Map<MemberId, number> {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("amountCents must be a non-negative integer");
  }
  if (participantIds.length === 0) {
    throw new Error("an expense needs at least one participant");
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error("participants must be unique");
  }

  const count = participantIds.length;
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;

  const shares = new Map<MemberId, number>();
  participantIds.forEach((id, index) => {
    shares.set(id, base + (index < remainder ? 1 : 0));
  });
  return shares;
}

/**
 * Computes each member's net balance across all expenses.
 * The payer is credited the full amount; each participant is debited their share.
 * The result always sums to zero.
 */
export function computeBalances(memberIds: MemberId[], expenses: Expense[]): Balance[] {
  if (new Set(memberIds).size !== memberIds.length) {
    throw new Error("member IDs must be unique");
  }

  const balances = new Map<MemberId, number>();
  for (const id of memberIds) balances.set(id, 0);

  for (const expense of expenses) {
    if (!balances.has(expense.payerId)) {
      throw new Error(`payer ${expense.payerId} is not a workspace member`);
    }

    const shares = splitEqually(expense.amountCents, expense.participantIds);
    for (const memberId of shares.keys()) {
      if (!balances.has(memberId)) {
        throw new Error(`participant ${memberId} is not a workspace member`);
      }
    }

    balances.set(expense.payerId, (balances.get(expense.payerId) ?? 0) + expense.amountCents);
    for (const [memberId, share] of shares) {
      balances.set(memberId, (balances.get(memberId) ?? 0) - share);
    }
  }

  return memberIds.map((memberId) => ({
    memberId,
    balanceCents: balances.get(memberId) ?? 0,
  }));
}

/**
 * Produces the minimal-ish list of payments that settles all balances.
 * Greedy matching of the largest debtor to the largest creditor.
 */
export function settleUp(balances: Balance[]): Settlement[] {
  const total = balances.reduce((sum, b) => sum + b.balanceCents, 0);
  if (total !== 0) {
    throw new Error("balances must sum to zero");
  }

  const creditors = balances
    .filter((b) => b.balanceCents > 0)
    .map((b) => ({ id: b.memberId, amount: b.balanceCents }));
  const debtors = balances
    .filter((b) => b.balanceCents < 0)
    .map((b) => ({ id: b.memberId, amount: -b.balanceCents }));

  const settlements: Settlement[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const pay = Math.min(creditors[c].amount, debtors[d].amount);
    settlements.push({ fromId: debtors[d].id, toId: creditors[c].id, amountCents: pay });
    creditors[c].amount -= pay;
    debtors[d].amount -= pay;
    if (creditors[c].amount === 0) c++;
    if (debtors[d].amount === 0) d++;
  }
  return settlements;
}
