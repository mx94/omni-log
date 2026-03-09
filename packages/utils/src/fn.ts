import { isPromise } from './type'
/**
 * 节流函数 在一段时间内只执行一次
 * @example
 * ```ts
 * const fn = throttleTime(() => {}, 1500)
 * fn() // call
 * fn() // not call
 * ```
 */
export function throttleTime(fn: Function, gapTime = 1500) {
  let lastTime: number
  return function (this: any) {
    const nowTime = Date.now()
    if (!lastTime || nowTime - lastTime > gapTime) {
      const result = fn.apply(this, arguments)
      lastTime = nowTime
      return result
    }
  }
}

/**
 * 节流函数 在异步函数执行完毕内只执行一次
 * @param fn - 异步函数返回值为Promise
 * @example
 * ```ts
 * const fn = throttleAsync(() => Promise.resolve(111)),
 *
 * fn() // call
 * fn() // not call
 * ```
 */
export function throttleAsync(fn: Function) {
  let pending = false
  return function (this: any) {
    if (pending) return
    pending = true
    const result = fn.apply(this, arguments)
    if (isPromise(result)) {
      return result.then(
        (res) => {
          pending = false
          return res
        },
        (err) => {
          pending = false
          throw err
        }
      )
    }
    pending = false
    return result
  }
}

/**
 * 防抖函数
 * @param func - 函数
 * @param wait - 时间
 * @example
 * ```ts
 * const fn = debounce(() => {})
 *
 * fn() // not call
 * fn() // call
 * ```
 */
export function debounce(func: Function, wait = 50) {
  let timer: any
  return function (this: any, ...args: unknown[]) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      func.apply(this, args)
      timer = null
    }, wait)
  }
}

/**
 * 缓存请求 只有第一次才会请求，后续获取都是第一次的promise缓存
 * 无法使用参数
 * @param func - 函数
 * @param catchTry - 是否在请求失败后重置
 *
 * @example
 * ```ts
 * const fn = cacheAsync(() => 123)
 * fn() // Promise 123
 * fn() // Promise 123
 *
 * const fn2 = cacheAsync(() => Promise.resolve(123))
 * fn() // Promise 123
 * fn() // Promise 123
 * ```
 */
export function cacheAsync<
  T extends (...args: any[]) => any,
  R = ReturnType<T>
>(func: T, catchTry = false): R extends Promise<any> ? R : Promise<R> {
  let promise: Promise<any> | null
  return function (this: any, force = false) {
    if (!force && promise) return promise
    const result = func()
    promise = !isPromise(result) ? Promise.resolve(result) : result
    if (catchTry) {
      promise.catch((err) => {
        promise = null
        throw err
      })
    }
    return promise
  } as any
}
