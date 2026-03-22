# @omni-log/utils

omni-log 内部使用的工具函数库，也可单独引用。

## 安装

```bash
npm install @omni-log/utils
```

## 函数一览

### 数组与对象

```ts
import { extend } from '@omni-log/utils'
// jQuery 风格的深/浅合并（同 $.extend）
const merged = extend(true, {}, target, source)
```

### 类型判断

```ts
import { isPlainObject, isFunction, isPromise, hasOwn } from '@omni-log/utils'
```

### 字符串

```ts
import { trimStr, camelize, hyphenate } from '@omni-log/utils'
trimStr('  hello  ') // 'hello'
camelize('foo-bar') // 'fooBar'
hyphenate('fooBar') // 'foo-bar'
```

### 日期

```ts
import { format } from '@omni-log/utils'
format(new Date(), 'YYYY-MM-DD HH:mm:ss')
```

### 防抖 / 节流

```ts
import {
  debounce,
  throttleTime,
  throttleAsync,
  cacheAsync
} from '@omni-log/utils'

// 防抖（默认 50ms）
const fn = debounce(() => {}, 300)

// 时间节流（同一时间窗口内只执行一次）
const fn2 = throttleTime(() => {}, 1500)

// 异步节流（上一次 Promise 未结束前不再触发）
const fn3 = throttleAsync(async () => fetchData())

// 首次调用后缓存 Promise，后续复用
const fn4 = cacheAsync(() => fetch('/api/config').then((r) => r.json()))
```

### 小程序平台检测

```ts
import { getEnvPlatform, getEnvPlatformApi } from '@omni-log/utils'
// 返回 'wx' | 'ali' | 'qq' | 'tt' | 'baidu' | 'ks' | 'web' | undefined
const platform = getEnvPlatform()
const api = getEnvPlatformApi() // { name, api }
```

### dataset 规范化

```ts
import { normalizeDataset } from '@omni-log/utils'
// 将小写 dataset key 还原为驼峰（微信小程序 dataset 会把驼峰转小写）
normalizeDataset(dataset)
```
