export * from './extend'
export * from './type'
export * from './date'
export * from './fn'

export function getEnvPlatform() {
  return getEnvPlatformApi()?.name
}

export function getEnvPlatformApi() {
  // @ts-ignore
  if (typeof qq !== 'undefined') return { name: 'qq', api: qq }
  // @ts-ignore
  if (typeof dd !== 'undefined') return { name: 'dd', api: dd }
  // @ts-ignore
  if (typeof ks !== 'undefined') return { name: 'ks', api: ks }
  // @ts-ignore
  else if (typeof tt !== 'undefined') return { name: 'tt', api: tt }
  // @ts-ignore
  else if (typeof swan !== 'undefined') return { name: 'baidu', api: swan }
  // @ts-ignore
  else if (typeof my !== 'undefined') return { name: 'ali', api: my }
  // @ts-ignore
  else if (typeof wx !== 'undefined') return { name: 'wx', api: wx }
  // @ts-ignore
  else if (typeof window !== 'undefined') return { name: 'web', api: window }
}

/**
 * 删除字符串首尾空
 * @param str - 要处理的字符串
 * @return 删除收尾空之后的字符串
 */
export function trimStr(str = '') {
  return str.replace(/(^\s*)|(\s*$)/g, '')
}

const camelizeRE = /-(\w)/g
/**
 * 连字符转驼峰
 */
export const camelize = (str: string): string =>
  str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))

const hyphenateRE = /\B([A-Z])/g
/**
 * 驼峰转连字符
 */
export const hyphenate = (str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

const datasetKey = 'omni_data_keys'
export function normalizeDataset(dataset: Record<string, any>, retain = true) {
  const res = Object.assign({}, dataset)
  if (res[datasetKey]) {
    res[datasetKey].split(',').forEach((v: string) => {
      const camelizeKey = camelize(v)
      const lowercaseKey = camelizeKey.toLowerCase()
      if (hasOwn(res, lowercaseKey)) {
        const val = res[lowercaseKey]
        if (!hasOwn(res, camelizeKey)) {
          res[camelizeKey] = val
          if (!retain) {
            delete res[lowercaseKey]
          }
        }
      }
    })
    if (!retain) {
      delete res[datasetKey]
    }
  }
  return res
}
