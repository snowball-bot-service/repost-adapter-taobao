import { RepostMethod } from '@snowball-bot/repost-adapter';
import { FetchTaobaoItemDetail } from './just-one-api/just-one-api.type';
import { JustOneAPI } from './just-one-api/just-one-api.api';

/** 淘宝/天猫商品 ID */
export type ItemId = string;

type RepostMethodPayloadMap = {
  post: FetchTaobaoItemDetail;
  profile: null;
  live: null;
};

/**
 * method -> 抓取闭包 的注册表。
 *
 * 每一项要么是接收 {@link JustOneAPI} 实例的包装闭包, 要么是 `null`
 * (表示淘宝渠道不支持此 method)。
 *
 * 注意: 这里只引用 {@link JustOneAPI} 的**类型**而非实例 —— 实例在 `initState`
 * 中拿到 token / http 后才创建, 再由 {@link fetchHandleDataFromAPI} 在调用点传入。
 * 用包装闭包 `(api, itemId) => api.fetchTaobaoItemDetail(itemId)` 而非直接引用
 * `api.fetchTaobaoItemDetail`, 可避免方法脱离实例后丢失 `this` 绑定。
 *
 * `satisfies` 校验每个 handler 的返回类型与 {@link RepostMethodPayloadMap} 一致。
 */
const PAYLOAD_FETCHERS = {
  post: (api: JustOneAPI, itemId: ItemId, version: "v5" | "v9") => api.fetchTaobaoItemDetail(itemId, version),
  profile: null,
  live: null,
} satisfies {
  [M in RepostMethod]:
    | ((api: JustOneAPI, itemId: ItemId, version: "v5" | "v9") => Promise<RepostMethodPayloadMap[M]>)
    | null;
};

/**
 * 将 URL 字符串解析成 URL 对象, 兼容协议相对地址 (以 `//` 开头)。
 * @param source
 */
export function extractURL(source: string): URL {
  // 协议相对地址 (//item.taobao.com/...) 补全为 https
  const normalized = source.startsWith('//') ? `https:${source}` : source;
  return new URL(normalized);
}

/**
 * 从淘宝/天猫商品 URL 中提取 itemId。
 *
 * @example //item.taobao.com/item.htm?id=894808822596 => "894808822596"
 * @param source 原始 URL
 * @returns itemId; 取不到时返回 null (eg. tb.cn 短链无 `id` 参数, 暂不支持)
 */
export function extractItemId(source: string): ItemId | null {
  try {
    return extractURL(source).searchParams.get('id');
  } catch {
    return null;
  }
}

/**
 * 进行对应的 API 请求, 拿到 Handle Data。
 *
 * @param api Just One API 客户端实例 (在 initState 中创建)
 * @param method 转发模式
 * @param itemId 商品 ID
 * @param version
 */
export async function fetchHandleDataFromAPI<M extends RepostMethod>(
  api: JustOneAPI,
  method: M,
  itemId: ItemId,
  version: "v5" | "v9" = "v5",
): Promise<RepostMethodPayloadMap[M]> {
  const fetcher = PAYLOAD_FETCHERS[method] as
    | ((api: JustOneAPI, itemId: ItemId, version: "v5" | "v9") => Promise<RepostMethodPayloadMap[M]>)
    | null;

  // null 项: 该渠道不支持此 method, 返回 null 回调
  if (!fetcher) {
    return null as RepostMethodPayloadMap[M];
  }

  return fetcher(api, itemId, version);
}
