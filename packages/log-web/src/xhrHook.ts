/* eslint-disable */
// @ts-nocheck
const realXhr = '_omni_rxhr'

export function configEvent(event: any, xhrProxy: any) {
  const e: any = {}
  for (const attr in event) e[attr] = event[attr]
  // xhrProxy instead
  e.target = e.currentTarget = xhrProxy
  return e
}

export function hook(proxy: Record<string, (...args: any[]) => any>) {
  window[realXhr] = window[realXhr] || XMLHttpRequest

  XMLHttpRequest = function (this: any) {
    const xhr = new window[realXhr]()
    for (const attr in xhr) {
      let type = ''
      try {
        type = typeof xhr[attr] // May cause exception on some browser
      } catch (e) {
        console.log(e)
      }
      if (type === 'function') {
        this[attr] = hookFunction(attr)
      } else if (attr !== 'xhr') {
        Object.defineProperty(this, attr, {
          get() {
            return xhr[attr]
          },
          set(value) {
            const that = this
            if (attr.substring(0, 2) === 'on') {
              xhr[attr] = function (e: any) {
                e = configEvent(e, that)
                proxy[attr] && proxy[attr].call(that, xhr, e)
                typeof value === 'function' && value.call(that, e)
              }
            } else {
              try {
                xhr[attr] = value
              } catch (e) {
                console.log(e)
              }
            }
          },
          enumerable: true
        })
      }
    }
    this.xhr = xhr
  }

  function hookFunction(fun: string) {
    return function (this: any) {
      const args = [].slice.call(arguments)
      if (proxy[fun]) {
        try {
          const ret = proxy[fun].call(this, args, this.xhr)
          if (ret) return ret
        } catch (e) {
          console.log(e)
        }
      }
      return this.xhr[fun].apply(this.xhr, args)
    }
  }

  return window[realXhr]
}

export function unHook() {
  if (window[realXhr]) XMLHttpRequest = window[realXhr]
  window[realXhr] = undefined
}
