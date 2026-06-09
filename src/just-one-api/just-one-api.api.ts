import { HttpManager, HttpRequestOptions, QueryParams } from '../utils/http';
import { JustOneApiException } from '../utils/error';
import {
  FetchTaobaoItemDetail,
  JustOneApiResponse,
} from './just-one-api.type';

/** 业务成功码 */
const SUCCESS_CODE = 0;

/**
 * 业务码 -> 默认消息。
 *
 * 当响应体未携带 `message` 时, 用此表补全错误描述。
 *
 * @see https://docs.justoneapi.com
 */
const CODE_MESSAGES: Record<number, string> = {
  100: 'Token 无效或已失效',
  301: '采集失败，请重试',
  302: '超出速率限制',
  303: '超出每日配额',
  400: '参数错误',
  500: '内部服务器错误',
  600: '权限不足',
  601: '余额不足',
};

/**
 * Just One API 客户端。
 *
 * 封装鉴权 (token 查询参数) 与统一的业务码解析:
 *   - {@link JustOneAPI.request} 通用请求方法, 自动注入 token、校验 `code`,
 *     成功时返回 `data` 负载, 失败时抛出 {@link JustOneApiException}
 *   - 各业务方法 (如 {@link JustOneAPI.fetchTaobaoItemDetail}) 在其上构建
 *
 * 实际网络收发委托给传入的 {@link HttpManager} (baseUrl / 超时 / 重试 / dispose)。
 */
export class JustOneAPI {
  /** 官方建议的最小超时 (ms), 采集类接口耗时较长 */
  static readonly RECOMMENDED_TIMEOUT_MS = 60_000;

  constructor(
    private readonly http: HttpManager,
    /** 此 API 服务的访问令牌 */
    private readonly token: string,
  ) {}

  /**
   * 通用 GET 请求 + 业务码解析。
   *
   * 自动:
   *   1. 注入鉴权参数 `token`
   *   2. 应用建议超时 (可被 `options` 覆盖)
   *   3. 校验返回体 `code`: 为 `0` 则返回 `data`, 否则抛 {@link JustOneApiException}
   *
   * @typeParam D - 期望的 `data` 负载类型
   * @param path 接口路径, 如 `/api/taobao/get-item-detail/v5`
   * @param query 业务查询参数 (无需包含 token)
   * @param options 透传给 {@link HttpManager} 的请求选项
   */
  async request<D>(
    path: string,
    query: QueryParams = {},
    options: HttpRequestOptions = {},
  ): Promise<D> {
    const res = await this.http.getJson<JustOneApiResponse<D>>(path, {
      timeoutMs: JustOneAPI.RECOMMENDED_TIMEOUT_MS,
      ...options,
      query: { token: this.token, ...query, ...options.query },
    });

    const code = Number(res.code);
    if (code !== SUCCESS_CODE) {
      const msg = res.message ?? CODE_MESSAGES[code] ?? 'Unknown error';
      throw new JustOneApiException(code, path, msg);
    }

    return res.data;
  }

  /**
   * 淘宝/天猫商品详情 (V5)。
   *
   * GET /api/taobao/get-item-detail/v5?token=<token>&itemId=<itemId>
   *
   * @param itemId 淘宝/天猫上的唯一商品标识符 (商品 ID)
   * @param version 采集版本，V5: 一毛一次，天猫商品采集不到；V9：两毛一次，天猫商品可以采集到
   */
  async fetchTaobaoItemDetail(
    itemId: string, version: "v5" | "v9" = "v5"
  ): Promise<FetchTaobaoItemDetail> {
    return this.request<FetchTaobaoItemDetail>(
      `/api/taobao/get-item-detail/${version}`,
      { itemId },
    );
  }
}
