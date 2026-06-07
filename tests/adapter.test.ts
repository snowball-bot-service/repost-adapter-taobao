import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  AdapterContext,
  RepostHandler,
} from '@snowball-bot/repost-adapter';
import { ParseLinkFailedException } from '@snowball-bot/repost-adapter';
import adapter from '../src';

function createMockContext(
  configValues: Record<string, unknown> = {}
): { ctx: AdapterContext; getHandler: () => RepostHandler } {
  let handler: RepostHandler | null = null;

  const ctx: AdapterContext = {
    on: vi.fn((event, h) => {
      if (event === 'onRepostRequest') handler = h;
    }),
    config: vi.fn((key: string) => configValues[key]) as AdapterContext['config'],
    helper: {
      pick: (record, key, fallback) => record[key] ?? fallback!,
    },
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };

  return {
    ctx,
    getHandler: () => {
      if (!handler) throw new Error('Handler not registered');
      return handler;
    },
  };
}

/** 一条精简的「商品详情 V5」成功响应 (字段取自真实样例) */
const ITEM_DETAIL_RESPONSE = {
  code: 0,
  message: null,
  data: {
    item: {
      trade: { buyEnable: null, cartEnable: null, isBanSale4Oversea: null },
      num_iid: '894808822596',
      title: '注水快速制冰 升级款硅胶食品级 按压式冰格制冰盒自制冻冰块神器',
      images: [
        '//img.alicdn.com/bao/uploaded/a.jpg',
        '//img.alicdn.com/bao/uploaded/b.jpg',
      ],
      video_thumbnail: null,
      properties: [{ name: '货号', value: 'bh005' }],
      desc_imgs: [],
      skus: {
        quantity: '1200',
        price: '59.8 - 116',
        promotion_price: '29.9 - 58',
        activity_price: null,
      },
      sku_base: [],
      sku_props: [],
      sku_images: {},
    },
    delivery: { from: null, to: null, delivery_fee: null, area_id: null },
    seller: {
      seller_id: null,
      seller_title: null,
      shop_title: '研选精品',
      shop_id: '569260887',
      shop_url: '//store.taobao.com/shop/view_shop.htm',
      shop_icon: '//img.alicdn.com/imgextra/icon.png',
      user_type: 'C',
      evaluates: null,
    },
  },
  recordTime: '2026-06-07T20:37:36',
};

const REQUESTER = { userId: 'REQUESTER_USERID', nickname: 'REQUESTER_NICKNAME' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('adapter', () => {
  it('exposes correct manifest', () => {
    expect(adapter.manifest.name).toBe('repost-adapter-taobao');
    expect(adapter.manifest.whitelistHosts).toContain('item.taobao.com');
  });

  it('registers handler on init', async () => {
    const { ctx } = createMockContext();
    await adapter.initState(ctx);
    expect(ctx.on).toHaveBeenCalledWith(
      'onRepostRequest',
      expect.any(Function)
    );
  });

  it('maps a taobao item to a standardized payload', async () => {
    // 拦截底层 fetch, 返回精简的商品详情响应
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(ITEM_DETAIL_RESPONSE), { status: 200 })
      )
    );

    const { ctx, getHandler } = createMockContext({
      justOneApiToken: 'test-token',
    });
    await adapter.initState(ctx);

    const result = await getHandler()({
      source: 'https://item.taobao.com/item.htm?id=894808822596',
      code: 'test',
      requester: REQUESTER,
    });

    expect(result).not.toBeNull();
    expect(result!.method).toBe('post');
    expect(result!.postId).toBe('894808822596');
    expect(result!.title).toBe(ITEM_DETAIL_RESPONSE.data.item.title);
    expect(result!.author.nickname).toBe('研选精品');
    expect(result!.author.userId).toBe('569260887');
    // 协议相对地址应补全为 https
    expect(result!.images).toContain('https://img.alicdn.com/bao/uploaded/a.jpg');
    // 正文含促销价
    expect(result!.content).toContain('29.9 - 58');
  });

  it('rejects a taobao link without itemId (含 tb.cn 短链)', async () => {
    const { ctx, getHandler } = createMockContext({
      justOneApiToken: 'test-token',
    });
    await adapter.initState(ctx);

    await expect(
      getHandler()({
        source: 'https://tb.cn/h.xxxxxx',
        code: 'test',
        requester: REQUESTER,
      })
    ).rejects.toBeInstanceOf(ParseLinkFailedException);
  });
});
