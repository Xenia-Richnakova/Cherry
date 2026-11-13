// api/src/server.test.ts
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../api/src/server";
import { MemoryStore } from "../api/src/memoryStore";

describe("expense listing and deletion", () => {
  let app: ReturnType<typeof createApp>;
  let workspaceId: string;

  beforeEach(async () => {
    app = createApp(new MemoryStore());
    const created = await request(app)
      .post("/workspaces")
      .send({ name: "Trip", memberIds: ["anna", "ben", "cara"] });
    workspaceId = created.body.id;
  });

  async function addExpense(payerId: string, amountCents: number, participantIds: string[]) {
    const res = await request(app)
      .post(`/workspaces/${workspaceId}/expenses`)
      .send({ payerId, amountCents, participantIds });
    return res.body as { id: string };
  }

  it("lists expenses in the order they were added", async () => {
    const first = await addExpense("anna", 3000, ["anna", "ben", "cara"]);
    const second = await addExpense("ben", 1200, ["anna", "ben"]);

    const res = await request(app).get(`/workspaces/${workspaceId}/expenses`);
    expect(res.status).toBe(200);
    expect(res.body.expenses.map((e: { id: string }) => e.id)).toEqual([first.id, second.id]);
  });

  it("returns an empty list when a workspace has no expenses", async () => {
    const res = await request(app).get(`/workspaces/${workspaceId}/expenses`);
    expect(res.status).toBe(200);
    expect(res.body.expenses).toEqual([]);
  });

  it("returns 404 when listing expenses for an unknown workspace", async () => {
    const res = await request(app).get("/workspaces/does-not-exist/expenses");
    expect(res.status).toBe(404);
  });

  it("deletes an expense and returns 204", async () => {
    const expense = await addExpense("anna", 3000, ["anna", "ben", "cara"]);

    const res = await request(app).delete(`/workspaces/${workspaceId}/expenses/${expense.id}`);
    expect(res.status).toBe(204);

    const list = await request(app).get(`/workspaces/${workspaceId}/expenses`);
    expect(list.body.expenses).toEqual([]);
  });

  it("recalculates balances after an expense is deleted", async () => {
    await addExpense("anna", 3000, ["anna", "ben", "cara"]);
    const dinner = await addExpense("ben", 1200, ["anna", "ben"]);

    await request(app).delete(`/workspaces/${workspaceId}/expenses/${dinner.id}`);

    const balances = await request(app).get(`/workspaces/${workspaceId}/balances`);
    expect(balances.body.balances).toEqual([
      { memberId: "anna", balanceCents: 2000 },
      { memberId: "ben", balanceCents: -1000 },
      { memberId: "cara", balanceCents: -1000 },
    ]);
  });

  it("returns 404 when deleting an expense that does not exist", async () => {
    const res = await request(app).delete(`/workspaces/${workspaceId}/expenses/missing`);
    expect(res.status).toBe(404);
  });

  it("returns 404 when deleting from an unknown workspace", async () => {
    const res = await request(app).delete("/workspaces/does-not-exist/expenses/anything");
    expect(res.status).toBe(404);
  });
});