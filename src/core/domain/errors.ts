/**
 * 领域错误与校验结果类型。
 */

/** 错误码枚举（避免 UI 依赖错误文案做判断） */
export const ERROR_CODES = {
  EMPTY_POOL: 'EMPTY_POOL',
  INVALID_BACKUP: 'INVALID_BACKUP',
  UNSUPPORTED_VERSION: 'UNSUPPORTED_VERSION',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  PERSON_NOT_FOUND: 'PERSON_NOT_FOUND'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** 领域异常（core 内不 throw 框架错误） */
export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/** 字段级错误：key 为字段名，value 为就近展示的中文提示 */
export type ValidationErrors = Record<string, string>;

/** 统一校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrors;
}

export function validationOk(): ValidationResult {
  return { valid: true, errors: {} };
}

export function validationFail(errors: ValidationErrors): ValidationResult {
  return { valid: false, errors };
}

/** 从校验结果中取第一条错误（用于 toast 摘要） */
export function firstValidationError(result: ValidationResult): string {
  const keys = Object.keys(result.errors);
  return keys.length > 0 ? result.errors[keys[0]] : '';
}
