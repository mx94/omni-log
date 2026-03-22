export const isArray = Array.isArray

export function getType(x: unknown): string {
  return Object.prototype.toString.call(x).slice(8, -1)
}

export function isUndef(v: unknown): v is void {
  return v === undefined || v == null
}

export function isSimpleValue(x: unknown): boolean {
  const simpleTypes = new Set(['undefined', 'boolean', 'number', 'string'])
  return x == null || simpleTypes.has(typeof x)
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object'
}

export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return getType(x) === 'Object'
}

export function isFunction(x: unknown): x is Function {
  return typeof x === 'function'
}

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return (
    isObject(val) &&
    isFunction((val as any).then) &&
    isFunction((val as any).catch)
  )
}
