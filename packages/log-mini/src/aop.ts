import { isPlainObject, isFunction, hasOwn } from '../../utils/src/index'
export type Target = Record<string, any>

type Before = (args: unknown[], name: PropertyKey) => any
type After = (result: unknown, args: unknown[], name: PropertyKey) => any
type AopError = (msg: Error | unknown, name: PropertyKey) => void

const SKIP = '__SKIP__AOP__'

export interface AopOpt {
  before?: Before
  after?: After
  error?: AopError
  shouldNew?: boolean
}

export interface AOPHideOpt {
  __aop_opt__: boolean
  options?: AopOptions
  other?: AopWrap
  shouldNew?: boolean
}

export type AopWrap = Before | AopOpt

export type AopOptions = Record<PropertyKey, AopWrap | AOPHideOpt | null>

/**
 * 代理对象
 */
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions,
  other?: AopWrap,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  other: Before,
  shouldNew?: boolean
): T
export function aopObject<T extends Record<PropertyKey, unknown>>(
  target: T,
  options: AopOptions | Before,
  other?: AopWrap | boolean,
  shouldNew?: boolean
): T {
  if (!isPlainObject(target)) return target
  if (isFunction(options)) {
    other = options
    options = null as any
  }
  // 多个参数other不传，直接shouldNew
  if (typeof other === 'boolean') {
    shouldNew = other
    other = undefined
  }
  const result: Record<PropertyKey, any> = {}
  Object.getOwnPropertyNames(target).forEach((k) => {
    let val = target[k]
    if (options && hasOwn(options, k)) val = proxyKey(target, options[k], k)
    else if (other) val = proxyKey(target, other as AopWrap, k)
    if (val === SKIP) {
      result[k] = target[k]
      return
    }
    result[k] = val
  })
  if (typeof options === 'object' && options != null) {
    for (const k in options) {
      if (!target[k] && options[k]) {
        const proxyResult = proxyKey(target, options[k] as any, k, shouldNew)
        if (proxyResult === SKIP) continue
        result[k] = proxyResult
      }
    }
  }
  return result as T
}

export function aop(other: Before): AOPHideOpt
export function aop(options: AopOptions, shouldNew?: boolean): AOPHideOpt
export function aop(
  options: AopOptions,
  other?: AopWrap,
  shouldNew?: boolean
): AOPHideOpt
export function aop(
  options: AopOptions | Before,
  other?: AopWrap | boolean,
  shouldNew?: boolean
): AOPHideOpt {
  // 单个参数的情况
  if (isFunction(options)) {
    other = options
    options = null as any
  }
  // 多个参数other不传，直接shouldNew
  if (typeof other === 'boolean') {
    shouldNew = other
    other = undefined
  }
  return {
    options: options as AopOptions,
    other: other as AopWrap,
    __aop_opt__: true,
    shouldNew
  }
}

/**
 * 获取 before 和 after 方法
 */
function getProxyObjFn(
  wrap: AopWrap,
  fatherShouldNew?: boolean
): [
  Before | null | undefined,
  After | null | undefined,
  AopError | null | undefined,
  boolean | undefined
] {
  let before = null
  let after = null
  let proxyError = null
  let shouldNew = fatherShouldNew
  if (isFunction(wrap)) {
    before = wrap
  } else {
    before = wrap.before
    after = wrap.after
    proxyError = wrap.error
    if (typeof wrap.shouldNew === 'boolean') {
      shouldNew = wrap.shouldNew
    }
  }
  return [before, after, proxyError, shouldNew]
}

const isAopOpt = (v: any): v is AOPHideOpt => v && v.__aop_opt__

/**
 * 代理对象的key
 */
function proxyKey(
  target: Target,
  wrap: AopWrap | AOPHideOpt,
  k: string | number,
  fatherShouldNew?: boolean
): any {
  const method = target[k]
  if (!wrap) return method
  if (isAopOpt(wrap)) {
    return aopObject(method, wrap.options as any, wrap.other, wrap.shouldNew)
  }
  if (method !== void 0 && !isFunction(method)) return method
  const [before, after, proxyError, shouldNew] = getProxyObjFn(
    wrap,
    fatherShouldNew
  )
  if (method === void 0) {
    if (typeof shouldNew === 'boolean') {
      if (!shouldNew) return SKIP
    } else if (!before && after) return SKIP
  }
  return function (this: any, ...args: unknown[]) {
    let result = void 0
    if (before) {
      result = tryFn(before, this, [args, k], proxyError, k)
    }
    let shouldFinally = false
    if (method) {
      try {
        result = method.apply(this, args)
      } catch (e) {
        shouldFinally = true
        if (after) tryFn(after, this, [result, args, k], proxyError, k)
        try {
          isFunction(proxyError) && proxyError(e, k)
        } catch (e) {}
        throw e
      }
    }
    if (!shouldFinally && after) {
      return tryFn(after, this, [result, args, k], proxyError, k)
    }
    return result
  }
}

function tryFn(
  fn: Function,
  context: any,
  args: unknown[],
  aopError: unknown,
  k: string | number
) {
  let result
  try {
    result = fn.apply(context, args)
  } catch (e) {
    if (isFunction(aopError)) {
      try {
        aopError(e, k)
      } catch (e) {}
    }
  }
  return result
}

interface Hooks {
  app: Set<AOPHideOpt>
  page: Set<AOPHideOpt>
  component: Set<AOPHideOpt>
}

const globalHook: Hooks = {
  app: new Set(),
  page: new Set(),
  component: new Set()
}

export type SetupAop = (globalHook: Hooks) => void

export function setupAOP(setup: SetupAop) {
  setup(globalHook)
}

export function callAOP<T extends Record<string, any>>(
  name: keyof Hooks,
  target: T,
  hookChain?: string[]
) {
  globalHook[name].forEach((hook) => {
    if (hookChain && hookChain.length > 0) {
      for (let index = 0; index < hookChain.length; index++) {
        if (!hook.options) return
        const _hook = hook.options[hookChain[index]]
        if (!isAopOpt(_hook)) return
        hook = _hook
      }
    }
    if (!hook) return
    if (isAopOpt(hook)) {
      target = aopObject<T>(
        target,
        hook.options as any,
        hook.other,
        hook.shouldNew
      )
    }
  })
  return target
}
