export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;
