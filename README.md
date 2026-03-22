# omni-log

面向小程序（微信 / 支付宝）和 Web（H5）的多端日志 SDK，**零侵入、自动采集、统一上报**。

---

## 能做什么

接入后无需手动打点，SDK 自动采集：

| 能力 | 小程序（log-mini） | Web（log-web） |
| --- | :---: | :---: |
| 页面生命周期（进入 / 隐藏 / 离开） | ✅ | ✅ |
| HTTP 请求（参数 / 响应 / 耗时 / 超时） | ✅ | ✅ |
| JS 错误 + 完整调用栈 | ✅ | ✅ |
| 未捕获 Promise rejection | ✅ | ✅ |
| 用户点击事件 | ✅ | ✅ |
| 常用 API 调用（navigateTo / showToast 等） | ✅ | — |
| Web 性能指标（FCP / LCP / CLS / INP / TTFB） | — | ✅ |
| Vue 全局错误捕获 | ✅ | ✅ |

---

## 快速接入（小程序）

### 安装

```bash
npm install @omni-log/log-mini
```

### 微信小程序

在 `app.js` 最顶部引入，**必须在 `App()` 之前调用**：

```js
import log from '@omni-log/log-mini'

log.init({
  appId: 'your-app-id',   // 日志服务接入标识
  domain: 'https://your-log-server.com/log/pushLog', // 上报地址
  isProd: true,           // false 时不上报（本地开发用）
  checkDev: true          // 自动检测开发者工具并禁用上报
})
```

接入完成。此后每次页面跳转、网络请求、报错、用户点击，都会自动收集并批量上报。

### 支付宝小程序

```js
import log from '@omni-log/log-mini'
// API 完全相同，SDK 自动识别运行环境（wx / my）
log.init({ ... })
```

### 手动上报自定义事件

```js
// 上报业务埋点
log.pushLog('12', '下单成功', { orderId: 'xxx', amount: 99 })
```

---

## 架构

```
@omni-log/log-mini  ───┐
                       ├─── @omni-log/log-core（缓存 / 分组 / 调度 / 上报）
@omni-log/log-web   ───┘
```

- **log-core**：与平台无关的核心层，负责日志队列管理、批量分组、失败重试
- **log-mini**：小程序适配层，通过 AOP 代理 `App()` / `Page()` / `Component()` 实现零侵入采集
- **log-web**：Web 适配层，通过 XHR Proxy实现请求拦截采集

---

## 包结构

| 包名 | 描述 | npm |
| --- | --- | --- |
| [`@omni-log/log-mini`](./packages/log-mini) | 小程序端 SDK（微信 / 支付宝） | [![npm](https://img.shields.io/npm/v/@omni-log/log-mini)](https://www.npmjs.com/package/@omni-log/log-mini) |
| [`@omni-log/log-web`](./packages/log-web) | Web / H5 端 SDK | [![npm](https://img.shields.io/npm/v/@omni-log/log-web)](https://www.npmjs.com/package/@omni-log/log-web) |
| [`@omni-log/log-core`](./packages/log-core) | 核心层 | — |

---

## 详细文档

- [小程序端完整文档 →](./packages/log-mini/README.md)
- [Web 端完整文档 →](./packages/log-web/README.md)

---

## 本地开发

```bash
pnpm i
pnpm run build-log
```

## License

[MIT](./LICENSE)
