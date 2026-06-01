export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const TWO_FACTOR_PENDING_COOKIE = "two_factor_pending";

/** 30 min — alinhado ao JWT_ACCESS_EXPIRES_IN padrão do backend */
export const ACCESS_COOKIE_MAX_AGE = 30 * 60;

/** 7 dias — alinhado ao refresh do backend */
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

/** 5 min — token pendente de 2FA após login */
export const TWO_FACTOR_PENDING_MAX_AGE = 5 * 60;
