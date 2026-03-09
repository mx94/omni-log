# @omni-log/log-web

Web / H5 端日志 SDK。

自动采集：页面路由切换、XHR 请求（请求参数、响应、耗时）、JS 运行时错误、资源加载错误、未捕获 Promise rejection、用户点击、Web 性能指标（FCP / LCP / CLS / INP / TTFB）。

## 安装

```bash
npm install @omni-log/log-web
```

## 快速开始

```js
import log from '@omni-log/log-web'

log.init({
  appId: 'your-app-id',
  domain: 'https://your-log-server.com/log/pushLog',
  isProd: process.env.NODE_ENV === 'production'
})
```

## 初始化配置

```ts
interface InitOptions {
  appId: string | number // 日志服务接入标识（必填）
  domain?: string // 上报地址
  isProd?: boolean // 默认 true；false 时不上报
  checkDev?: boolean // 默认 true；自动识别私有 IP/localhost 并禁用上报
  isDebug?: boolean // 上报至本地 127.0.0.1:7001
  failureRetry?: number // 失败重试次数，默认 1
  params?: Params // 公共参数（对象或函数）
  config?: Config // 细粒度开关
  requestAfterCallback?: // 每次 HTTP 完成后的回调
  (data: { req: any; res: any; type: string }) => void
}
```

## 细粒度控制（Config）

```js
log.setConfig({
  slientLog: false, // 完全关闭上报
  silentHttp: [/\/ping$/], // 屏蔽匹配的 URL（支持 RegExp 数组）
  silentClick: false, // 不上报点击
  silentElementError: true, // 不上报资源加载失败（img/script 等）
  onlyReportErrors: true // 只上报 Error 实例，其余走 eventType 16
})
```

## Vue 集成

```js
// Vue 2
app.use(log.vue2Plugin)

// Vue 3
app.use(log.vue3Plugin)

// Vue Router（上报路由切换）
log.useVueRouter(router)
```

## 公共参数

```js
log.logCore.setParams({ userId: '123', appVersion: '1.2.0' })

// 或动态函数
log.logCore.setParams((logItem, params) => ({
  traceId: generateTraceId()
}))
```

## 手动上报

```js
// 上报自定义事件
log.pushLog('12', 'button_click', { buttonId: 'submit' })

// 上报错误
log.pushLog('6', '支付失败', { reason: 'timeout' })
```

## 性能指标

初始化后自动采集并上报（eventType 13）：

- **FCP** — 首次内容绘制
- **LCP** — 最大内容绘制
- **CLS** — 累计布局偏移
- **INP** — 交互到下次绘制
- **TTFB** — 首字节时间（含 DNS / TCP / TLS / 请求 / 响应各阶段耗时）
- **WebView 启动耗时** — 通过 `appParams.startTimestamp` 计算

## 离线包支持

```js
log.logCore.setAppParams({
  startTimestamp: Date.now() // 容器创建时间戳（毫秒）
})
```

## 页签关闭前上报

```js
window.addEventListener('beforeunload', () => {
  log.lastReport() // 使用 fetch keepalive 确保数据不丢失
})
```

## 日志事件类型参考

| eventType | 含义                    |
| --------- | ----------------------- |
| 3         | 路由切换（afterEach）   |
| 6         | JS 错误 / 资源加载错误  |
| 7         | XHR 请求                |
| 8         | 点击事件                |
| 12        | 自定义事件              |
| 13        | 性能指标 / WebView 启动 |
| 14        | 设备信息                |
| 16        | 未分类错误              |
| 28        | console 输出            |
