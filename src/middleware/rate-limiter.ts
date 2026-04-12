import rateLimit from "express-rate-limit";

// ==========================================
// レートリミット (SaaSエンドポイント用)
// ==========================================

// 一般的なエンドポイントの制限 (IPベース)
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分
  max: 60, // 1分間に60回まで
  message: {
    jsonrpc: "2.0",
    error: {
      code: -32005,
      message: "Too many requests. Please try again later."
    },
    id: null
  },
  standardHeaders: true,
  legacyHeaders: false,
});
