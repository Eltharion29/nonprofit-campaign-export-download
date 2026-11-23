import { z } from "zod";
import { InfraiError, infrai } from "./infrai.ts";

export const exportRequest = z.object({
  campaign: z.string().min(1),
  donors: z.array(z.object({ name: z.string().min(1), amount: z.number().nonnegative(), receipt_id: z.string().min(1) })),
  volunteer_reminders: z.array(z.object({ volunteer: z.string().min(1), due: z.string().min(1) })),
});
export type ExportRequest = z.infer<typeof exportRequest>;

const DEFAULT_BUCKET = "nonprofit-report-exports";

function exportBucket(): string {
  return process.env.INFRAI_EXPORT_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function makeCsv(input: ExportRequest): string {
  const rows = ["campaign,donor,amount,receipt_id", ...input.donors.map((d) => [input.campaign, d.name, d.amount, d.receipt_id].map(csvCell).join(","))];
  return rows.join("\n") + "\n";
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function createExport(raw: unknown): Promise<{ csv: string; downloadUrl: string; documentKey: string }> {
  const input = exportRequest.parse(raw);
  const csv = makeCsv(input);
  const documentKey = `campaigns/${encodeURIComponent(input.campaign)}/report.csv`;
  const bucket = exportBucket();
  try {
    await infrai.storage.bucket.create({ name: bucket, idempotency_key: `bucket-${bucket}` });
  } catch (error) {
    if (!(error instanceof InfraiError) || error.status !== 409 || !/EXIST/i.test(error.code)) throw error;
  }
  const signed = await infrai.storage.object.presign(bucket, documentKey, {
    op: "put",
    expires_seconds: 900,
    content_type: "text/csv",
    idempotency_key: `export-${input.campaign}`,
  });
  const rendered = await infrai.pdf.generate({
    markdown: `# ${input.campaign}\n\n${csv}`,
    page_size: "A4",
    orientation: "portrait",
    store: true,
  });
  return { csv, downloadUrl: signed.url, documentKey: rendered.key ?? documentKey };
}
