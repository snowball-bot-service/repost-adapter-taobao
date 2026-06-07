import 'dotenv/config'; // 自动加载 .env 文件
import adapter from '../src';
import { MockAdapterHost } from './harness';
import * as process from 'node:process';

async function main() {
  const host = new MockAdapterHost({
    justOneApiToken: process.env.justOneApiToken,
  });

  await host.register(adapter);

  // 测试 URL 列表：随便改、随便加
  const testUrls = [
    // 正常商品链接 (需 .env 配置 justOneApiToken)
    'https://item.taobao.com/item.htm?id=894808822596',
    // tb.cn 短链: 暂不支持, 应抛 ParseLinkFailedException
    'https://tb.cn/h.xxxxxx',
  ];

  for (const url of testUrls) {
    try {
      const res = await host.emitRepost(url);

      // 转发 post 后，模拟用户点 🍓 触发 strawberry 进程（取原图）
      if (res?.method === 'post' && res.strawberry) {
        await host.emitProcess('strawberry', res.postId);
      }
    } catch (err) {
      console.error(`✗ Failed:`, err);
    }
  }

  await host.dispose();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
