export function extend<T extends Record<PropertyKey, any>>(
  target: T,
  ...args: unknown[]
): T
export function extend<T>(isDeep: boolean, target: T, ...args: unknown[]): T
export function extend(...args: unknown[]): any {
  let target: any = args[0] || {} //目标对象
  let isDeep = false //是否进行深拷贝
  let h = 1 //参数个数
  const n = args.length //实际传入的参数个数
  let temp // 临时保存源参数
  if (typeof target === 'boolean') {
    isDeep = args[0] as boolean
    target = args[1] || {}
    h = 2
  }
  if (typeof target !== 'object' && typeof target !== 'function') {
    target = {}
  }

  for (; h < n; h++) {
    temp = arguments[h]
    if (typeof temp !== undefined) {
      for (const t in temp) {
        const src = target[t]
        const copy = temp[t]
        if (target === copy) {
          continue
        }
        if (
          isDeep &&
          temp[t] &&
          typeof temp[t] === 'object' &&
          !temp[t].nodeType
        ) {
          // 如果是数组，进行浅拷贝
          if (Array.isArray(temp[t])) {
            target[t] = temp[t]
          } else {
            target[t] = extend(isDeep, src || {}, temp[t])
          }
        } else {
          //浅拷贝
          if (temp[t] !== undefined) {
            target[t] = temp[t]
          }
        }
      }
    }
  }
  return target
}
