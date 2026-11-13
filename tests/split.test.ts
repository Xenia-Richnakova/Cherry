import { describe, expect, it } from "vitest";
import { splitEqually, computeBalances, settleUp, Expense } from "../api/src/split";

describe("splitEqually", () => {
  it("splits evenly when divisible", () => {
    const shares = splitEqually(300, ["a", "b", "c"]);
    expect([...shares.values()]).toEqual([100, 100, 100]);
  });

  it("gives leftover cents to the first participants and sums exactly", () => {
    const shares = splitEqually(100, ["a", "b", "c"]);
    expect([...shares.values()]).toEqual([34, 33, 33]);
    expect([...shares.values()].reduce((s, v) => s + v, 0)).toBe(100);
  });

  it("handles a single participant", () => {
    const shares = splitEqually(550, ["a"]);
    expect([...shares.values()]).toEqual([550]);
  });

  it("handles zero as a valid amount", () => {
    const shares = splitEqually(0, ["a", "b"]);
    expect([...shares.values()]).toEqual([0, 0]);
  });

  it("rejects non-integer or negative amounts", () => {
    expect(() => splitEqually(10.5, ["a"])).toThrow();
    expect(() => splitEqually(-1, ["a"])).toThrow();
  });

  it("rejects an empty participant list and duplicates", () => {
    expect(() => splitEqually(100, [])).toThrow();
    expect(() => splitEqually(100, ["a", "a"])).toThrow();
  });
});

describe("computeBalances", () => {
  it("credits the payer and debits each participant, summing to zero", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "a", amountCents: 3000, participantIds: ["a", "b", "c"] },
    ];
    const balances = computeBalances(["a", "b", "c"], expenses);
    expect(balances).toEqual([
      { memberId: "a", balanceCents: 2000 },
      { memberId: "b", balanceCents: -1000 },
      { memberId: "c", balanceCents: -1000 },
    ]);
    expect(balances.reduce((s, b) => s + b.balanceCents, 0)).toBe(0);
  });

  it("returns zero balances when there are no expenses", () => {
    const balances = computeBalances(["a", "b"], []);
    expect(balances.every((b) => b.balanceCents === 0)).toBe(true);
  });

  it("rejects a payer who is not a member", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "x", amountCents: 100, participantIds: ["a"] },
    ];
    expect(() => computeBalances(["a", "b"], expenses)).toThrow();
  });

  it("rejects duplicate member IDs", () => {
    expect(() => computeBalances(["a", "a"], [])).toThrow();
  });

  it("rejects a participant who is not a member", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "a", amountCents: 100, participantIds: ["a", "x"] },
    ];
    expect(() => computeBalances(["a", "b"], expenses)).toThrow();
  });

  it("treats prototype names like 'constructor' as ordinary non-members", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "constructor", amountCents: 100, participantIds: ["a"] },
    ];
    expect(() => computeBalances(["a", "b"], expenses)).toThrow();
  });

  it("does not modify the expenses it receives", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "a", amountCents: 300, participantIds: ["a", "b"] },
    ];
    const snapshot = JSON.parse(JSON.stringify(expenses));
    computeBalances(["a", "b"], expenses);
    expect(expenses).toEqual(snapshot);
  });
});

describe("settleUp", () => {
  it("settles a simple two-person debt with one payment", () => {
    const balances = [
      { memberId: "a", balanceCents: 1000 },
      { memberId: "b", balanceCents: -1000 },
    ];
    expect(settleUp(balances)).toEqual([
      { fromId: "b", toId: "a", amountCents: 1000 },
    ]);
  });

  it("settles everyone so that applying the payments zeroes all balances", () => {
    const expenses: Expense[] = [
      { id: "e1", payerId: "a", amountCents: 3000, participantIds: ["a", "b", "c"] },
      { id: "e2", payerId: "b", amountCents: 1200, participantIds: ["a", "b"] },
    ];
    const balances = computeBalances(["a", "b", "c"], expenses);
    const payments = settleUp(balances);

    const net = new Map(balances.map((b) => [b.memberId, b.balanceCents]));
    for (const p of payments) {
      net.set(p.fromId, (net.get(p.fromId) ?? 0) + p.amountCents);
      net.set(p.toId, (net.get(p.toId) ?? 0) - p.amountCents);
    }
    expect([...net.values()].every((v) => v === 0)).toBe(true);
  });

  it("never produces a zero-amount payment", () => {
    const balances = [
      { memberId: "a", balanceCents: 500 },
      { memberId: "b", balanceCents: 0 },
      { memberId: "c", balanceCents: -500 },
    ];
    const payments = settleUp(balances);
    expect(payments.every((p) => p.amountCents > 0)).toBe(true);
  });

  it("refuses balances that do not sum to zero", () => {
    expect(() =>
      settleUp([
        { memberId: "a", balanceCents: 500 },
        { memberId: "b", balanceCents: -100 },
      ])
    ).toThrow();
  });
});