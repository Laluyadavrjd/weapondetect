/** Shared API response types. All values are populated from live backend responses. */

export interface HealthResponse {
  status: string;
  model_status: "ready" | "unavailable";
  model_name: string;
  device: string;
  version: string;
}

export interface ModelClass {
  id: number;
  name: string;
}

export interface ModelInfoResponse {
  model_family: string;
  checkpoint: string;
  checkpoint_status: "loaded" | "missing";
  classes: ModelClass[];
  input_size: number;
  default_confidence: number;
  device: string;
  loaded: boolean;
  last_health_check: string;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Detection {
  class_id: number;
  class_name: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface DetectResponse {
  success: boolean;
  image_width: number;
  image_height: number;
  detections: Detection[];
  inference_ms: number;
  model_status: string;
  annotated_image: string;
}

export interface ApiError {
  detail: string;
}

export interface MetricsResponse {
  available: boolean;
  message?: string;
  precision?: number;
  recall?: number;
  f1?: number;
  map50?: number;
  map5095?: number;
  per_class?: { name: string; precision: number; recall: number; ap: number }[];
  inference_latency_ms?: number;
  evaluated_at?: string;
  dataset?: string;
}

export interface VideoDetectResponse {
  success: boolean;
  /** Relative backend URL serving the annotated mp4, e.g. "/api/videos/<job_id>". Prefix with API_BASE. */
  annotated_video_url: string;
  frames_processed: number;
  frames_total: number;
  detections_total: number;
  inference_ms: number;
  model_status: string;
}

/** Normalised fetch failure kinds so the UI can render the right message. */
export type ApiFailure =
  | { kind: "offline" }
  | { kind: "http"; status: number; detail: string };
