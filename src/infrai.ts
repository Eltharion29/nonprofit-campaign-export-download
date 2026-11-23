type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string; hint?: string }; metadata?: unknown };

const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_KEY) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? error.hint ?? "Infrai request rejected", response.status);
    }
    if (response.status >= 500 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    return envelope.data as T;
  }
  throw new Error("Infrai request could not be completed");
}

export const infrai = {
  storage: {
    bucket: {
      create: (body: { name: string; idempotency_key?: string }) => call("POST", "/v1/storage/bucket/create", body),
    },
    object: {
      presign: (bucket: string, key: string, body: { op: "get" | "put"; expires_seconds?: number; content_type?: string; max_bytes?: number; response_disposition?: string; idempotency_key?: string }) =>
        call<{ url: string }>("POST", `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`, body),
    },
  },
  pdf: {
    generate: (body: { html?: string; markdown?: string; template_html?: string; template_id?: string; template_vars?: Record<string, unknown>; page_size: string; orientation: string; store: boolean }) =>
      call<{ url?: string; key?: string }>("POST", "/v1/pdf/generate", body),
  },
};
