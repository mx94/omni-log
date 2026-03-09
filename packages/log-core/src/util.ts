function base64urlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) {
    str += '='
  }
  const decoded = atob(str)
  let result = ''
  for (let i = 0; i < decoded.length; i++) {
    result += '%' + ('00' + decoded.charCodeAt(i).toString(16)).slice(-2)
  }
  return decodeURIComponent(result)
}

function jwtDecode(token: string): any {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT token')
  }
  return JSON.parse(base64urlDecode(parts[1]))
}
export function getSessionId() {
  return Number(Math.random().toString() + Date.now()).toString(36)
}

const phoneReg =
  /\b(13[0-9]|14[01456879]|15[0-35-9]|16[2567]|17[0-8]|18[0-9]|19[0-35-9])\d{4}(\d{4})\b/g

export function filterMobile(str: string) {
  return str && str.replace
    ? str.replace(phoneReg, (_, a, b) => a + '11111211111' + b)
    : str
}

const idNumberReg = /\b(\d{6})(?:\d{8})(\d{3}.{1})\b/g
export function filterIDNumber(str: string) {
  return str && str.replace
    ? str.replace(idNumberReg, (_, a, b) => a + '11111311111' + b)
    : str
}

export function parseJwtToken(jwtToken: string) {
  if (typeof jwtToken !== 'string') return null
  try {
    const tokenObj: { sub: string } = jwtDecode(jwtToken)
    if (tokenObj && tokenObj.sub) {
      const sub = JSON.parse(tokenObj.sub)
      return sub
    }
  } catch (e) {
    //
  }
  return null
}

export function wrapObjectCall<T extends Record<string, any>>(
  target: T,
  fn: (obj: {
    type: 'sync' | 'async'
    status: 'fulfilled' | 'rejected'
    key: string
    args: unknown[]
    res: unknown
    duration?: number
  }) => void
): T {
  if (typeof target !== 'object' || typeof fn !== 'function') return target
  for (const k in target) {
    const origin = target[k]
    if (typeof origin === 'function') {
      Object.defineProperty(target, k, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: function (...args: unknown[]) {
          let result
          let startTime: number
          try {
            startTime = Date.now()
            result = origin.apply(this, args)
          } catch (e) {
            fn({
              type: 'sync',
              status: 'rejected',
              key: k,
              args,
              res: e
            })
            throw e
          }
          if (result && result.then) {
            return result.then(
              (res: unknown) => {
                try {
                  fn({
                    type: 'async',
                    status: 'fulfilled',
                    key: k,
                    args,
                    res,
                    duration: Date.now() - startTime
                  })
                } catch (e) {}
                return res
              },
              (e: unknown) => {
                try {
                  fn({
                    type: 'async',
                    status: 'rejected',
                    key: k,
                    args,
                    res: e,
                    duration: Date.now() - startTime
                  })
                } catch (e) {}
                throw e
              }
            )
          }
          try {
            fn({
              type: 'sync',
              status: 'fulfilled',
              key: k,
              args,
              res: result,
              duration: Date.now() - startTime
            })
          } catch (e) {}
          return result
        }
      })
    }
  }
  return target
}
