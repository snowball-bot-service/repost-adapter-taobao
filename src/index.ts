import {
  Adapter,
  AdapterContext,
  ParseLinkFailedException,
  FetchPostFailedException,
  AdapterRepostRequestParams,
  AdapterRepostResponsePayload,
  SocialProvider,
  AdapterProcessRequestParams,
  AdapterProcessResponsePayload,
  RepostMethod,
  RepostBadgeParams,
} from '@snowball-bot/repost-adapter';
import { HttpManager } from './utils/http';
import { extractItemId, fetchHandleDataFromAPI } from './manager';
import {
  JustOneApiException,
  UnsupportedProcessException,
} from './utils/error';
import { JustOneAPI } from './just-one-api/just-one-api.api';
import { TaobaoItem } from './just-one-api/just-one-api.type';

export { HttpManager, HttpError } from './utils/http';
export type {
  HttpManagerOptions,
  HttpRequestOptions,
  HttpMethod,
  QueryParams,
} from './utils/http';

// ============================================================================
// TODO: 1. 修改下方 manifest 信息
// ============================================================================
//
// - manifest.name: 必须以 `repost-adapter-` 开头
// - manifest.provider: 你的平台标识符，比如 'twitter' / 'bilibili'
// - manifest.whitelistHosts: 你的 adapter 接管的域名列表（不带 www）
// - manifest.version: 适配器自己的版本号，每次有重大变化时递增
// - manifest.author: 你的昵称
// - manifest.billing: 各类费用雪花定价
// - manifest.providerInfo: 该适配器的基本信息
//
// ============================================================================

export interface AdapterOption {
  justOneApiToken?: string;
}

/**
 * 常量仓库
 * @param apiBaseURL API 基础地址
 * @param provider 提供商
 * @param apiTimeout API 超时时间（毫秒）
 * @param apiRetries API 重试次数
 */
const CONST: {
  apiBaseURL: string;
  provider: SocialProvider;
  apiTimeout: number;
  apiRetries: number;
} = {
  provider: 'taobao',
  apiBaseURL: 'https://api.justoneapi.com',
  // 采集类接口耗时较长, 官方建议至少 60s
  apiTimeout: 60_000,
  apiRetries: 1,
};

/**
 * 实例仓库
 * @param instance.http 模块级 HTTP 客户端, 在 initState 中创建, dispose 中销毁
 * @param instance.api  Just One API 客户端, 在 initState 中创建
 */
const INSTANCE: {
  http: HttpManager | null;
  api: JustOneAPI | null;
} = {
  http: null,
  api: null,
};

const adapter: Adapter = {
  manifest: {
    name: `repost-adapter-${CONST.provider}`,
    provider: CONST.provider,
    whitelistHosts: ['e.tb.cn', 'item.taobao.com', 'h5.m.taobao.com'],
    version: 1,
    author: 'Rominwolf',
    billing: {
      text: 100,
      token: 100,
      media: 1000,
      green: 1,
    },
    providerInfo: {
      name: '淘宝',
      icon: '🛒',
      color: '#FFFFFF',
      bgColor: '#F86323',
    },
  },

  /**
   * 适配器初始化时触发，在此处注册各类资源
   * @param ctx
   */
  async initState(ctx: AdapterContext) {
    // 读取配置（可选）。配置由核心通过 `ctx.config(key)` 提供。
    const justOneApiToken = ctx.config<keyof AdapterOption>('justOneApiToken');

    if (!justOneApiToken) {
      ctx.logger.warn(
        `[${CONST.provider}] 未配置 justOneApiToken, API 请求将以 code 100 (Token 无效) 失败。`
      );
    }

    // 创建 HTTP 客户端 (基于 fetch), 统一处理 baseUrl / 超时 / 重试
    INSTANCE.http = new HttpManager({
      baseUrl: CONST.apiBaseURL,
      timeoutMs: CONST.apiTimeout,
      retries: CONST.apiRetries,
      logger: ctx.logger,
    });

    // 创建 Just One API 客户端 (封装鉴权与业务码解析)
    INSTANCE.api = new JustOneAPI(INSTANCE.http, justOneApiToken ?? '');

    // 注册转发请求处理器 (token 已注入客户端, handler 无需再读)
    ctx.on('onRepostRequest', (req) => handleRepostRequest(req, ctx));
    ctx.on('onProcessRequest', (req) => handleProcessingRequest(req, ctx));

    ctx.logger.info(`[${CONST.provider}] Adapter initialized.`);
  },

  /**
   * 适配器销毁时触发，在此处清理各类资源
   */
  async dispose() {
    // 中断在途请求并释放 HTTP 客户端
    INSTANCE.http?.dispose();
    INSTANCE.http = null;
    INSTANCE.api = null;
  },
};

// ============================================================================
// 工具函数
// ============================================================================

/** 协议相对地址 (以 `//` 开头) 补全为 https */
function normalizeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('//') ? `https:${url}` : url;
}

/** 构建正文: 价格 + 关键属性 (标题已由独立的 `title` 字段承载, 此处不重复) */
function buildContent(item: TaobaoItem): string {
  const lines: string[] = [];

  const price = item.skus.promotion_price ?? item.skus.price;
  if (price) lines.push(`💰 ${price}`);

  if (item.properties.length) {
    const props = item.properties
      .map((p) => `${p.name}：${p.value}`)
      .join('\n');
    lines.push(props);
  }

  return lines.join('\n\n');
}

/** 构建徽章: 价格 / 店铺信息 */
function buildBadges(
  item: TaobaoItem,
  shopTitle: string | null
): RepostBadgeParams[][] {
  const badges: RepostBadgeParams[] = [];

  const price = item.skus.promotion_price ?? item.skus.price;
  if (price) badges.push({ emoji: '💰', name: price });

  if (shopTitle) badges.push({ emoji: '🏪', name: shopTitle });

  return badges.length ? [badges] : [];
}

// ============================================================================
// TODO: 2. 实现下方的 handle 函数
// ============================================================================

async function handleRepostRequest(
  req: AdapterRepostRequestParams,
  ctx: AdapterContext
): Promise<AdapterRepostResponsePayload | null> {
  const { logger } = ctx;

  logger.debug(`[${CONST.provider}] fetching ${req.source}`);

  // 从 req.source 解析出 itemId (仅支持带 ?id= 的 item.taobao.com 链接)
  const itemId = extractItemId(req.source);

  if (!itemId) {
    throw new ParseLinkFailedException(
      req.source,
      CONST.provider,
      '无法解析 itemId (暂不支持 tb.cn 短链, 请使用 item.taobao.com 商品链接)'
    );
  }

  // 淘宝渠道只有商品 (post) 一种形态
  const method: RepostMethod = 'post';

  // 调用平台 API 拿到商品详情; 业务码失败包装为框架的 FetchPostFailedException
  let detail;
  try {
    // 先通过 V5 拿
    detail = await fetchHandleDataFromAPI(INSTANCE.api!, method, itemId, 'v5');
  } catch (err) {
    if (err instanceof JustOneApiException) {
      if (err.code !== 301) {
        throw new FetchPostFailedException(
          itemId,
          CONST.provider,
          req.source,
          `[${err.code}] ${err.msg}`
        );
      }

      // 如果上游返回 301，则使用 V9 重试
      try {
        detail = await fetchHandleDataFromAPI(
          INSTANCE.api!,
          method,
          itemId,
          'v9'
        );
      } catch (err) {
        if (err instanceof JustOneApiException) {
          throw new FetchPostFailedException(
            itemId,
            CONST.provider,
            req.source,
            `[${err.code}] ${err.msg}`
          );
        }
        throw err;
      }
    } else {
      throw err;
    }
  }

  const { item, seller } = detail;

  logger.debug(`[${CONST.provider}] fetched item ${itemId}: ${item.title}`);

  const images = item.images
    .map((url) => normalizeUrl(url))
    .filter((url): url is string => Boolean(url));

  // 转换成标准 response 格式
  return {
    method,
    provider: CONST.provider,
    code: req.code,
    originalUrl: req.source,
    requester: req.requester,

    postId: itemId,

    title: item.title,

    author: {
      userId: seller.shop_id ?? undefined,
      nickname: seller.shop_title ?? '淘宝商家',
      headshotUrl: normalizeUrl(seller.shop_icon),
    },

    cover: normalizeUrl(item.video_thumbnail) ?? images[0],

    content: buildContent(item),

    images,

    badges: buildBadges(item, seller.shop_title),
  };
}

async function handleProcessingRequest(
  req: AdapterProcessRequestParams,
  ctx: AdapterContext
): Promise<AdapterProcessResponsePayload | null> {
  const { logger } = ctx;
  const { method, source } = req;

  logger.debug(`[${CONST.provider}] fetching ${method}: ${source}`);

  // 抛出不支持的进程
  throw new UnsupportedProcessException(method, source);
}

export default adapter;
