# @omni-log/error

omni-log 内部使用的错误类型定义，提供结构化错误对象（`QError`）。

## 安装

```bash
npm install @omni-log/error
```

## 使用

```ts
import type { QError } from '@omni-log/error'

// QError 是带 code 字段的结构化错误，可用于在 onUnhandledRejection 中过滤已知的非异常拒绝
function handleRejection(reason: string | QError<any>) {
  if (typeof reason !== 'string' && reason.code === 'KNOWN_REJECT') {
    // 已知的非异常拒绝（如用户主动取消），跳过上报
    return
  }
  // 其他情况正常上报
}
```
