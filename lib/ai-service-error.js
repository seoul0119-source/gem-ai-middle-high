// Public service failures use a fixed allowlist. Never expose a provider's
// message, request details, credentials, or arbitrary error code to students.
const CREDIT_CODES = new Set([
  "credit_balance_exhausted", "insufficient_quota", "billing_hard_limit_reached"
]);

export function aiServiceUnavailable() {
  return { status: 503, payload: {
    error: "AI 수업 서비스 연결이 잠시 원활하지 않습니다. 잠시 후 다시 시도해 주세요.",
    code: "ai_service_unavailable", retryable: true, pauseVoice: true
  } };
}

export function providerAiServiceError(status, data) {
  if (![402, 403, 429].includes(status)) return null;
  const codes = [data?.error?.code, data?.error?.type];
  if (codes.some(code => CREDIT_CODES.has(code))) {
    return { status: 503, payload: {
      error: "AI 수업 서비스 이용 한도에 도달했습니다. 선생님께 서비스 이용 한도 확인을 요청해 주세요.",
      code: "ai_credit_exhausted", retryable: false, pauseVoice: true
    } };
  }
  if (status === 429 && codes.includes("rate_limit_exceeded")) {
    return { status: 429, payload: {
      error: "AI 수업 요청이 잠시 몰려 연결을 멈췄습니다. 잠시 후 다시 시도해 주세요.",
      code: "ai_rate_limited", retryable: true, pauseVoice: true
    } };
  }
  return null;
}

export class AiServiceError extends Error {
  constructor(serviceError) {
    super(serviceError.payload.code);
    this.name = "AiServiceError";
    this.status = serviceError.status;
    this.payload = serviceError.payload;
  }
}
