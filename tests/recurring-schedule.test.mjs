import assert from "node:assert/strict";
import test from "node:test";
import { nextMonthlyDate, needsConfirmation, todayInBangkok } from "../lib/recurring-schedule.ts";

const subscription = { active: true, confirmed_due: null, next_due: "2026-10-05", reminder_days: 3 };

test("monthly dates clamp short months and restore the original renewal day", () => {
  assert.equal(nextMonthlyDate("2026-01-31", 31), "2026-02-28");
  assert.equal(nextMonthlyDate("2026-02-28", 31), "2026-03-31");
  assert.equal(nextMonthlyDate("2027-01-31", 31), "2027-02-28");
  assert.equal(nextMonthlyDate("2028-01-31", 31), "2028-02-29");
  assert.equal(nextMonthlyDate("2026-12-15", 15), "2027-01-15");
});

test("reminders open before renewal and remain pending when overdue", () => {
  assert.equal(needsConfirmation(subscription, "2026-10-01"), false);
  assert.equal(needsConfirmation(subscription, "2026-10-02"), true);
  assert.equal(needsConfirmation(subscription, "2026-11-10"), true);
  assert.equal(needsConfirmation({ ...subscription, confirmed_due: "2026-10-05" }, "2026-10-02"), false);
  assert.equal(needsConfirmation({ ...subscription, active: false }, "2026-10-02"), false);
  assert.equal(needsConfirmation({ ...subscription, confirmed_due: "2026-09-05" }, "2026-10-02"), true);
});

test("renewal checks use Bangkok date at the UTC date boundary", () => {
  assert.equal(todayInBangkok(new Date("2026-10-01T17:00:00Z")), "2026-10-02");
  assert.equal(todayInBangkok(new Date("2026-10-01T16:59:59Z")), "2026-10-01");
});
