import assert from "node:assert/strict";
import test from "node:test";
import { makeCsv, exportRequest } from "./export-service.ts";

test("campaign export keeps receipt rows and quotes donor names", () => {
  const request = exportRequest.parse({
    campaign: "Spring appeal",
    donors: [{ name: "Lee, Morgan", amount: 42.5, receipt_id: "R-7" }],
    volunteer_reminders: [{ volunteer: "Sam", due: "2026-04-10" }],
  });
  assert.equal(makeCsv(request), "campaign,donor,amount,receipt_id\nSpring appeal,\"Lee, Morgan\",42.5,R-7\n");
});
