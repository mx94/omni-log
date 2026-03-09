export function trim(str: string) {
  return str.replace(/^\s+|\s+$/g, '')
}

export function formateHeaders(xhr: any) {
  return (
    xhr.resHeader ||
    xhr
      .getAllResponseHeaders()
      .split('\r\n')
      .reduce(function (ob: any, str: any) {
        if (str === '') return ob
        const m = str.split(':')
        ob[m.shift()] = trim(m.join(':'))
        return ob
      }, {})
  )
}

/**
 * 判断是否本地ip
 * @param addr
 * @returns
 */
export function isPrivateHostname(addr: string) {
  if (
    addr === 'localhost' ||
    addr === 'local.qingx.cn' ||
    addr === 'local.example.com'
  )
    return true
  return (
    /^(::f{4}:)?10\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?192\.168\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?172\.(1[6-9]|2\d|30|31)\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(
      addr
    ) ||
    /^(::f{4}:)?127\.([0-9]{1,3})\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^(::f{4}:)?169\.254\.([0-9]{1,3})\.([0-9]{1,3})$/i.test(addr) ||
    /^f[cd][0-9a-f]{2}:/i.test(addr) ||
    /^fe80:/i.test(addr) ||
    /^::1$/.test(addr) ||
    /^::$/.test(addr)
  )
}

let app: any = null

export function tryGetApp() {
  if (app) return app
  try {
    app = getApp()
  } catch (e) {}
  return app
}

export function stringify(target: any) {
  try {
    return JSON.stringify(target)
  } catch (e) {
    return ''
  }
}
