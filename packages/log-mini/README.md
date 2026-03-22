# @omni-log/log-mini

微信小程序、支付宝小程序日志 SDK。

自动采集：页面生命周期（onLaunch / onShow / onLoad 等）、HTTP 请求（成功 / 失败 / 超时）、JS 错误、未捕获的 Promise rejection、用户点击、showToast、navigateTo 等常用 API 调用。

## 安装

```bash
npm install @omni-log/log-mini
```

## 快速开始

### 微信小程序

在 `app.js` 最顶部引入并初始化，**必须在 `App()` 之前调用**：

```js
import log from '@omni-log/log-mini'

log.init({
  appId: 'your-app-id', // 必填，日志服务接入标识
  domain: 'https://your-log-server.com/log/pushLog', // 必填，日志上报地址
  isProd: true, // 是否为生产环境（false 时不上报）
  checkDev: true, // 自动检测微信开发者工具并禁用上报
  params: {
    version: '1.0.0' // 附加到每条日志的自定义字段
  }
})
```

### 支付宝小程序

```js
import log from '@omni-log/log-mini'
// API 完全相同，SDK 会自动识别运行环境
log.init({ ... })
```

### uni-app

```js
import log from '@omni-log/log-mini'

log.init({
  appId: 'your-app-id',
  domain: 'https://your-log-server.com/log/pushLog',
  framework: 'uniapp' // 可选，默认 uniapp；也支持 'taro'
})
```

## 初始化配置

```ts
interface InitOptions {
  appId: string | number // 日志服务接入标识（必填）
  domain?: string // 上报地址（必填，除非 isDebug 为 true）
  isProd?: boolean // 默认 true；false 时不上报任何数据
  checkDev?: boolean // 默认 true；自动检测 IDE 环境并禁用上报
  isDebug?: boolean // true 时上报至本地 127.0.0.1:7001（开发用）
  failureRetry?: number // 上报失败后的重试次数，默认 1
  params?: Params // 附加到每条日志的公共字段，可为对象或函数
  config?: Config // 细粒度控制哪些事件上报（见下方 Config）
  framework?: 'uniapp' | 'taro' // 框架类型，影响点击事件的函数名提取
  xcxCiUrl?: string // CI 工具专用上报地址
}
```

## 细粒度控制（Config）

```ts
log.setConfig({
  slientLog: false, // true → 完全关闭上报
  silentHttp: false, // true 或 RegExp[] → 屏蔽 HTTP 上报（正则黑名单）
  silentClick: false, // true → 不上报点击事件
  silentElementError: true, // true → 不上报资源加载错误
  silentHttpFineControl: false, // true → 仅上报显式带 reportLog: true 的请求
  onlyReportErrors: true // true → 只有 Error 类型才上报到 eventType 6
})
```

## 公共参数

每条日志都会附加公共参数，支持对象或动态函数：

```js
// 静态对象
log.logCore.setParams({ userId: '123', version: '2.0.0' })

// 动态函数（每次打日志时执行）
log.logCore.setParams((logItem, currentParams) => ({
  userId: getApp().globalData.userId
}))
```

## 手动上报

```js
// 上报自定义事件（eventType 12）
log.pushLog('12', 'purchase_success', { orderId: 'xxx', amount: 99 })

// 页面进入（eventType 3）
log.pushLog('3', '/pages/home/index', { query: {} })
```

## Vue 错误集成

```js
// Vue 2
app.use(log.vue2Plugin)

// Vue 3
app.use(log.vue3Plugin)
```

## 监听指定 API

```js
// 额外监听某些小程序 API 的调用结果
log.warpUserApi(['requestPayment', 'login'], {
  login(logItem, req) {
    logItem.eventType = '9'
  }
})
```

## 日志事件类型参考

| eventType | 含义                   |
| --------- | ---------------------- |
| 1         | App onLaunch           |
| 2         | App onShow             |
| 3         | Page onShow            |
| 4         | Page onHide            |
| 5         | Page onLoad            |
| 6         | JS 错误                |
| 7         | HTTP 请求              |
| 8         | 点击事件               |
| 9         | 小程序 API 调用        |
| 10        | 重要函数（下拉刷新等） |
| 11        | showToast              |
| 12        | 自定义事件             |
| 14        | 设备信息               |
| 16        | 未分类错误             |
| 28        | console 输出           |
