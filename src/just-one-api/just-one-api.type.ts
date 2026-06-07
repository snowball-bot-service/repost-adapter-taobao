/**
 * Just One API 通用响应体。
 *
 * 所有接口统一返回此结构, 业务结果通过 {@link JustOneApiResponse.code} 判断
 * (`0` 表示成功)。
 *
 * @typeParam D - `data` 字段的业务负载类型
 */
export interface JustOneApiResponse<D> {
  /**
   * 业务码 (`0` 表示成功)。
   *
   * OpenAPI 中声明为 string, 实际可能为 number, 解析时统一 `Number()` 归一化。
   */
  code: number | string;
  /** 可读的响应消息 (成功时可能为 null) */
  message?: string | null;
  /** 业务负载 */
  data: D;
  /** 数据采集时间 (ISO 8601) */
  recordTime?: string;
}

// ============================================================================
// 淘宝/天猫商品详情 (V5) — data 负载
//
// 字段命名沿用接口原样 (snake_case 与 camelCase 混用)。许多字段在部分商品上
// 会返回 null, 故大量使用可空类型。图片 / 链接 URL 多为协议相对 (以 `//` 开头)。
// ============================================================================

/** 交易能力标记 */
export interface TaobaoItemTrade {
  /** 是否可直接购买 */
  buyEnable: boolean | null;
  /** 是否可加入购物车 */
  cartEnable: boolean | null;
  /** 是否禁止海外销售 */
  isBanSale4Oversea: boolean | null;
}

/** 商品属性键值对 */
export interface TaobaoItemProperty {
  name: string;
  value: string;
}

/** 价格 / 库存汇总 (区间形态, 如 `"59.8 - 116"`) */
export interface TaobaoItemSkuSummary {
  /** 总库存 */
  quantity: string | null;
  /** 原价区间 */
  price: string | null;
  /** 促销价区间 */
  promotion_price: string | null;
  /** 活动价区间 */
  activity_price: string | null;
}

/** 单个 SKU 的价格 / 库存 */
export interface TaobaoItemSku {
  skuId: string;
  /** 规格路径, 形如 `pid:vid`, 多维以 `;` 连接 */
  propPath: string;
  price: string | null;
  promotion_price: string | null;
  activity_price: string | null;
  quantity: string | null;
}

/** SKU 规格维度下的某个可选值 */
export interface TaobaoItemSkuPropValue {
  vid: string;
  name: string;
  /** 该选项对应的图片 (可空) */
  image?: string | null;
}

/** SKU 规格维度 (如「颜色分类」) */
export interface TaobaoItemSkuProp {
  pid: string;
  name: string;
  values: TaobaoItemSkuPropValue[];
}

/** 商品主体 */
export interface TaobaoItem {
  trade: TaobaoItemTrade;
  /** 商品 ID (数字串) */
  num_iid: string;
  title: string;
  cat_id: string | null;
  cat_name: string | null;
  brandName: string | null;
  /** 销量 */
  sales: number | null;
  /** 商品详情页链接 (协议相对) */
  detail_url: string;
  /** 主图列表 (协议相对) */
  images: string[];
  /** 主图视频地址 */
  video: string | null;
  /** 主图视频封面 */
  video_thumbnail: string | null;
  /** 参与价格区分的属性名 (以 ` / ` 连接) */
  properties_cut: string | null;
  /** 商品属性键值对 */
  properties: TaobaoItemProperty[];
  /** 图文详情页地址 */
  desc_url: string | null;
  /** 详情图列表 (协议相对) */
  desc_imgs: string[];
  /** 价格 / 库存汇总 */
  skus: TaobaoItemSkuSummary;
  /** 各 SKU 明细 */
  sku_base: TaobaoItemSku[];
  /** SKU 规格维度定义 */
  sku_props: TaobaoItemSkuProp[];
  /** `propPath` -> 图片 URL 的映射 */
  sku_images: Record<string, string>;
}

/** 配送信息 */
export interface TaobaoDelivery {
  /** 发货地 */
  from: string | null;
  /** 收货地 */
  to: string | null;
  /** 运费 */
  delivery_fee: string | null;
  /** 地区编码 */
  area_id: string | null;
}

/** 卖家 / 店铺信息 */
export interface TaobaoSeller {
  seller_id: string | null;
  seller_title: string | null;
  shop_title: string | null;
  shop_id: string | null;
  /** 店铺链接 (协议相对) */
  shop_url: string | null;
  /** 店铺头像 (协议相对) */
  shop_icon: string | null;
  /** 卖家类型, `C` = 个人(C 店), `B` = 企业/天猫 */
  user_type: string | null;
  /** 评价信息 */
  evaluates: unknown;
}

/** 淘宝/天猫商品详情 (V5) 的 `data` 负载 */
export interface TaobaoItemDetail {
  item: TaobaoItem;
  delivery: TaobaoDelivery;
  seller: TaobaoSeller;
}

/** {@link JustOneAPI.fetchTaobaoItemDetail} 的返回类型 */
export type FetchTaobaoItemDetail = TaobaoItemDetail;
