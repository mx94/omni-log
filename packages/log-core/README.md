# @omni-log/log-core

`@omni-log/log-mini` 和 `@omni-log/log-web` 共用的核心层。

包含日志的缓存、分组、去重、序列化、脱敏和上报调度逻辑，以及全部事件类型的 TypeScript 类型定义。

一般情况下你不需要直接安装这个包，通过端侧 SDK（`log-mini` / `log-web`）间接使用即可。需要自定义适配器（如覆盖请求实现或继承核心类）时才直接引用。

## 安装

```bash
npm install @omni-log/log-core
```

## 核心类 LogReportCoreSdk

```ts
import { LogReportCoreSdk } from '@omni-log/log-core'

const sdk = new LogReportCoreSdk({
  originRequest: (params) => {
    /* 实现 HTTP 请求 */
  },
  appId: 'your-app-id',
  domain: 'https://your-log-server.com/log/pushLog'
})

sdk.pushLog({
  eventType: '12',
  name: 'custom_event',
  timestamp: Date.now(),
  payloads: { CustomBean: { key: 'value' } }
})
```

## 上报逻辑

- 日志先写入本地队列，每 2 秒（可配置）统一触发一次上报
- 同一批次超过 30 条或数据体超过 6MB 时自动分组
- 支持失败重试，超过上报错误阈值（7 次）后自动停止，防止无限上报

## 工具函数

```ts
import {
  getSessionId, // 生成会话 ID
  filterMobile, // 脱敏手机号
  filterIDNumber, // 脱敏身份证号
  parseJwtToken, // 解析 JWT payload（返回 sub 对象）
  wrapObjectCall, // 拦截对象上所有函数的调用（用于上报 JSBridge 等）
  parseError, // 解析任意 Error 对象为结构化堆栈
  errorStackParser, // 低级堆栈解析（Chrome / Safari 均支持）
  createVueErrorHandler // 生成 Vue errorHandler 钩子
} from '@omni-log/log-core'
```

## 类型导出

```ts
import type {
  LogItem,
  Config,
  Options,
  Params,
  ParamsObject,
  DeviceParams,
  // 各事件 Model 类型
  ErrorBeanModel,
  HttpBeanModel,
  TapBeanModel
  // ...
} from '@omni-log/log-core'
```

完整类型列表见 [`src/types.ts`](./src/types.ts)。
