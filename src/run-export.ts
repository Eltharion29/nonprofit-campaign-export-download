import { createExport } from "./export-service.ts";

const example = {
  campaign: "Winter food fund",
  donors: [
    { name: "Amina Chen", amount: 125, receipt_id: "R-1042" },
    { name: "Luis Ortega", amount: 80, receipt_id: "R-1043" },
  ],
  volunteer_reminders: [{ volunteer: "Priya Shah", due: "2026-11-02" }],
};

const result = await createExport(example);
console.log(JSON.stringify({ downloadUrl: result.downloadUrl, documentKey: result.documentKey }, null, 2));
