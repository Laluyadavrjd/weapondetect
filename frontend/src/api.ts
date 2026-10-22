import type {
  ApiError,
  DetectResponse,
  HealthResponse,
  MetricsResponse,
  ModelInfoResponse,
  VideoDetectResponse,
} from "./types";
import type { ApiFailure } from "./types";
export type { ApiFailure };

/** Base URL of the FastAPI backend. Configured via VITE_API_URL. */
export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

async function parseFailure(res: Response): Promise<ApiFailure> {
  let detail = `Request failed with status ${res.status}`;
  try {
    const body = (await res.json()) as ApiError;
    if (body && typeof body.detail === "string" && body.detail.length > 0) {
      detail = body.detail;
    }
  } catch {
    /* keep default */
  }
  return { kind: "http", status: res.status, detail };
}

function toFailure(err: unknown): ApiFailure {
  if (err instanceof TypeError) {
    // fetch throws TypeError on network failure / CORS / unreachable host
    return { kind: "offline" };
  }
  if (typeof err === "object" && err !== null && "kind" in err) {
    return err as ApiFailure;
  }
  return { kind: "offline" };
}

async function getJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw await parseFailure(res);
    return (await res.json()) as T;
  } catch (err) {
    throw toFailure(err);
  }
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form });
    if (!res.ok) throw await parseFailure(res);
    return (await res.json()) as T;
  } catch (err) {
    throw toFailure(err);
  }
}

export const api = {
  health: () => getJson<HealthResponse>("/health"),
  modelInfo: () => getJson<ModelInfoResponse>("/api/model-info"),
  metrics: () => getJson<MetricsResponse>("/api/metrics"),
  detectImage: (file: File, confidence: number) => {
    const form = new FormData();
    form.append("file", file);
    form.append("confidence", String(confidence));
    return postForm<DetectResponse>("/api/detect", form);
  },
  detectVideo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return postForm<VideoDetectResponse>("/api/detect-video", form);
  },
};

/** Human-readable message for an ApiFailure. */
export function failureMessage(f: ApiFailure): string {
  if (f.kind === "offline") {
    return "Cannot reach the backend. Make sure the API server is running (see README) and the VITE_API_URL points at it.";
  }
  if (f.status === 400) return `Invalid request: ${f.detail}`;
  if (f.status === 413) return `File too large: ${f.detail}`;
  if (f.status === 503)
    return `Model unavailable: ${f.detail}. The inference engine did not load its weights.`;
  if (f.status === 404)
    return "This endpoint is not implemented by the backend yet.";
  return f.detail;
}
