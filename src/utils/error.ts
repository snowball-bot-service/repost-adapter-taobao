import { ProcessMethod, RepostMethod } from '@snowball-bot/repost-adapter';

export abstract class SnowballException extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 获取 Handle Data 失败错误
 */
export class FetchHandleDataFailedException extends SnowballException {
  constructor(
    public readonly method: RepostMethod,
    public readonly handleId: string,
    public readonly msg: string
  ) {
    super(
      `Fetch Handle Data Failed Exception | Method: ${method} | Handle Id: ${handleId} | Message: ${msg}`
    );
  }
}

/**
 * 不支持的类型错误
 */
export class UnsupportedMethodException extends SnowballException {
  constructor(
    public readonly method: RepostMethod,
    public readonly handleId: string
  ) {
    super(
      `Unsupported Method Exception | Method: ${method} | Handle Id: ${handleId}`
    );
  }
}

/**
 * 不支持的进程错误
 */
export class UnsupportedProcessException extends SnowballException {
  constructor(
    public readonly process: ProcessMethod,
    public readonly source: string
  ) {
    super(
      `Unsupported Method Exception | Process: ${process} | Source: ${source}`
    );
  }
}

/**
 * 不支持的语言错误
 */
export class UnsupportedLanguageException extends SnowballException {
  constructor(
    public readonly code: string,
    public readonly locale: string,
  ) {
    super(
      `Unsupported Language Exception | Code: ${code} | Locale: ${locale}`
    );
  }
}

/**
 * Just One API 业务错误 (返回体中的 `code` 非 0 时抛出)。
 */
export class JustOneApiException extends SnowballException {
  constructor(
    /** 业务码 (非 0) */
    public readonly code: number,
    /** 请求路径 */
    public readonly path: string,
    /** 业务消息 */
    public readonly msg: string,
  ) {
    super(`Just One API Exception | Code: ${code} | Path: ${path} | Message: ${msg}`);
  }
}
