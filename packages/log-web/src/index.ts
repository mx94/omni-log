import { hook as hookXhr, unHook } from './xhrHook'
import {
  formateHeaders,
  isPrivateHostname,
  tryGetApp,
  stringify
} from './utils'
import type {
  Options,
  Character,
  Config,
  RemoteAppConfig
} from '@omni-log/log-core'
import {
  LogReportCoreSdk,
  parseError,
  createVueErrorHandler,
  evenTypeEnum,
  type LogItem,
  type ErrorBeanModel,
  type UNErrorBeanModel,
  type LogItemMap,
  type PickBean,
  type ConsoleBeanModel
} from '@omni-log/log-core'
import UaParser from 'ua-parser-js'
import { onCLS, onLCP, onFCP, onINP } from 'web-vitals/attribution'
import { onTTFB, type TTFBMetric } from 'web-vitals'

export {
  getSessionId,
  filterIDNumber,
  filterMobile,
  parseJwtToken,
  wrapObjectCall
} from '@omni-log/log-core'

export { tryGetApp }

export { LogReportCoreSdk, Options, Character, Config, RemoteAppConfig }

export type InitOptions = Omit<Options, 'originRequest'> & {
  requestAfterCallback?: (data: {
    req: Record<string, any>
    res: Record<string, any>
    type: string
  }) => void
}

export class ReportLog {
  originXHR: any
  logCore: LogReportCoreSdk
  initOptions: InitOptions | null
  inSetInterval: boolean
  protected currentPath: string
  vue2Plugin: { install: (...args: unknown[]) => void }
  vue3Plugin: { install: (...args: unknown[]) => void }
  useVueRouter: (router: unknown) => void
  constructor() {
    this.originXHR = XMLHttpRequest
    this.inSetInterval = false
    this.initOptions = null
    this.currentPath = ''

    this.logCore = new LogReportCoreSdk()

    const that = this
    this.vue2Plugin = {
      install(Vue: any) {
        const originError = Vue.config.errorHandler
        const errorHandler = createVueErrorHandler(that, originError)
        Vue.config.errorHandler = errorHandler
      }
    }

    this.useVueRouter = function (router: any) {
      router.beforeEach((to: any, from: any, next: any) => {
        that.pushLog(
          '12',
          `beforeEach`,
          Object.assign({ href: window.location.href }, to, {
            matched: null,
            page: to.path
          })
        )
        next()
      })
      router.afterEach((route: any) => {
        this.currentPath = route.path
        that.pushLog(
          '3',
          route.path,
          Object.assign({ href: window.location.href }, route, {
            matched: null,
            page: route.path
          })
        )
      })
    }

    this.vue3Plugin = {
      install(app: any) {
        const originError = app.config.errorHandler
        const errorHandler = createVueErrorHandler(that, originError)
        app.config.errorHandler = errorHandler
      }
    }
    // 性能数据
    this.reportPerformance()
  }

  initAop() {
    // 空函数兼容小程序调用
  }

  getConnection() {
    return (
      (navigator as any).connection ||
      (navigator as any).webkitConnection ||
      (navigator as any).mozConnection
    )
  }

  getNetworkType() {
    const connection = this.getConnection()
    let netState = 'unknown'
    if (connection) {
      netState = connection.type
      if (netState === 'cellular' && connection.effectiveType) {
        netState = connection.effectiveType.replace('slow-', '')
      } else if (!['none', 'wifi'].includes(netState)) {
        netState = 'unknown'
      }
    } else if (navigator.onLine === false) {
      netState = 'none'
    }
    return netState as any
  }

  listenNetworkStatusChange() {
    const connection = this.getConnection()
    if (connection) {
      connection.addEventListener('change', () => {
        const netState = this.getNetworkType()
        Object.assign(this.logCore.deviceInfo, { netState })
      })
    }
  }

  init(options: InitOptions) {
    this.initOptions = options || {}
    const p = new UaParser()
    const browserInfo = p.getBrowser()
    const osInfo = p.getOS()
    const deviceInfo = p.getDevice()
    let sessionId = window.sessionStorage.getItem('log_sessionId')
    const now = Date.now()
    const log_sessionId_timestamp =
      window.sessionStorage.getItem('log_sessionId_timestamp') || '0'
    const info = {
      brand: browserInfo.name,
      SDKVersion: browserInfo.version,
      model: `${deviceInfo.vendor} ${deviceInfo.model}`,
      platform: osInfo.name,
      system: osInfo.version,
      netState: this.getNetworkType(),
      screenSize: `${window.screen.height}*${window.screen.width},${window.devicePixelRatio}`
    }
    if (
      now - parseInt(log_sessionId_timestamp) > 1000 * 60 * 60 * 3 ||
      !sessionId
    ) {
      sessionId = this.logCore.getSessionId()
      window.sessionStorage.setItem('log_sessionId', sessionId)
      this.logCore.setDeviceInfo(info)
    } else {
      this.logCore.deviceInfo = info
    }
    window.sessionStorage.setItem('log_sessionId_timestamp', now.toString())
    this.listenNetworkStatusChange()

    this.logCore.setParams({
      sessionId: sessionId
    })

    this.logCore.init(
      Object.assign({}, options, {
        originRequest: this.reportApi.bind(this)
      })
    )

    this.checkDev()
    this.rewriteSetInterval()
    this.proxyXhr()
    this.proxyError()
    this.proxyEvent()
    this.reportWebviewStartTime()
  }

  checkDev() {
    try {
      if (
        this.logCore.checkDev &&
        window &&
        isPrivateHostname(window.location.hostname)
      ) {
        console.warn(`【@omni-log/log-web】自动判断为开发环境，已禁用日志上报`)
        this.logCore.isProd = false
      }
    } catch (e) {}
  }

  setConfig(config: Config) {
    this.logCore.setConfig(config)
  }

  pushLog<
    T extends LogItem,
    E extends T['eventType'],
    N extends T['name'],
    P extends LogItemMap[E]['payloads']
  >(eventType: E, name: N, payloads?: PickBean<P>, type?: any) {
    const data = {
      eventType,
      name,
      payloads: {
        [evenTypeEnum[eventType]]: payloads
      },
      timestamp: Date.now()
    } as LogItem
    if (type) data.payloads.type = type
    this.pushTransformLog(data)
  }

  lastReport() {
    this.logCore.lastReport()
  }
  // 上报性能数据
  reportPerformance() {
    const name = this.getCurrentPath()
    const collectPerformanceData = (metric: any) => {
      this.pushTransformLog({
        eventType: '13',
        name,
        payloads: {
          [evenTypeEnum['13']]: metric
        },
        timestamp: Date.now()
      })
    }
    onFCP((metric) => {
      delete metric?.attribution?.fcpEntry
      collectPerformanceData(metric)
    })
    onLCP((metric) => {
      delete metric?.attribution?.lcpEntry
      collectPerformanceData(metric)
    })
    onCLS(collectPerformanceData)
    onINP(collectPerformanceData)
    /** https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Navigation_timing */
    onTTFB((metric: TTFBMetric) => {
      const entries = metric.entries[metric.entries.length - 1]
      if (!entries) return
      const obj: Record<string, any> = {
        REDIRECT: entries.redirectEnd - entries.redirectStart,
        DNS: entries.domainLookupEnd - entries.domainLookupStart,
        TCP: entries.connectEnd - entries.connectStart,
        TLS: entries.requestStart - entries.secureConnectionStart,
        REQ: entries.responseStart - entries.requestStart,
        RES: entries.responseEnd - entries.responseStart,
        DOM_LOADED: entries.domContentLoadedEventEnd - entries.domInteractive,
        DOM_COMPLETE: entries.domComplete - entries.domInteractive,
        DOM_INTERACTIVE: entries.domInteractive - entries.responseEnd,
        READY: Math.max(
          entries.domContentLoadedEventEnd - (entries.activationStart || 0),
          0
        ),
        LOAD: Math.max(
          entries.loadEventStart - (entries.activationStart || 0),
          0
        )
      }
      collectPerformanceData(Object.assign(metric, obj))
    })
  }
  /** 上报容器启动时长 */
  reportWebviewStartTime() {
    const appParams = this.logCore.getAppParams()
    if (typeof appParams.startTimestamp === 'number')
      this.pushTransformLog({
        eventType: '12',
        name: 'webviewStartTime',
        timestamp: Date.now(),
        payloads: {
          [evenTypeEnum['12']]: {
            startTime: Math.max(
              window.performance.timeOrigin - appParams.startTimestamp,
              0
            ),
            page: this.getCurrentPath()
          }
        }
      })
  }

  // 重写setInterval
  rewriteSetInterval() {
    try {
      const originSetInterval = setInterval
      const _this = this
      // @ts-ignore
      // eslint-disable-next-line no-global-assign
      setInterval = function () {
        const callback = arguments[0]
        if (callback && callback.apply) {
          arguments[0] = function () {
            _this.inSetInterval = true
            const result = callback.apply(this, arguments)
            _this.inSetInterval = false
            return result
          }
        }
        // @ts-ignore
        return originSetInterval.apply(this, arguments)
      }
    } catch (e) {}
  }

  // 重写console
  rewriteConsole(isProd: boolean) {
    const originConsoleLog = console.log
    const originConsoleError = console.error
    const originConsoleWarn = console.warn
    const originConsoleInfo = console.info
    const eventType = '28'
    // test、dev上报
    if (!isProd) {
      console.log = function (...args: Parameters<Console['log']>) {
        return fn({
          target: this,
          args,
          type: 'log',
          originFn: originConsoleLog
        })
      }

      console.warn = function (...args: Parameters<Console['warn']>) {
        return fn({
          target: this,
          args,
          type: 'warn',
          originFn: originConsoleWarn
        })
      }

      console.info = function (...args: Parameters<Console['info']>) {
        return fn({
          target: this,
          args,
          type: 'info',
          originFn: originConsoleInfo
        })
      }
    }

    // 任何环境都会上报
    console.prod = function (...args: Parameters<Console['log']>) {
      return fn({
        target: this,
        args,
        type: 'prod',
        originFn: originConsoleLog
      })
    }

    console.error = function (...args: Parameters<Console['error']>) {
      return fn({
        target: this,
        args,
        type: 'error',
        originFn: originConsoleError
      })
    }

    const fn = ({
      target,
      args,
      type,
      originFn
    }: {
      target: Console
      args: ConsoleBeanModel['payloads']['ConsoleBean']['args']
      type: ConsoleBeanModel['payloads']['ConsoleBean']['type']
      originFn: Console['log' | 'warn' | 'error' | 'info']
    }) => {
      // 避免在数据转化过程中造成的循环引用（vue在warn时会上报proxy对象，然后上报时会stringfy再次触发get然后再次warn，warn又被重写又去上报）
      if (this.logCore.transformLogIng) return
      // 过滤ptp log
      if (typeof args[0] === 'string' && /【ptp log】：/.test(args[0]))
        return originFn.apply(target, args)
      const name =
        args
          .map((item) => {
            return (typeof item !== 'object' || item === null) &&
              typeof item !== 'function' &&
              typeof item !== 'symbol'
              ? `${item}`
              : ''
          })
          .filter(Boolean)
          .join(' ') || this.getCurrentPath()
      this.pushTransformLog({
        eventType,
        name,
        payloads: {
          [evenTypeEnum[eventType]]: {
            args,
            page: this.getCurrentPath(),
            type
          }
        },
        timestamp: Date.now()
      })
      return originFn.apply(target, args)
    }
  }

  ajaxReport(params: any) {
    const url = params.url

    const xmlhttp = new this.originXHR()
    xmlhttp.open(params.method, url, true)

    xmlhttp.setRequestHeader('Content-Type', 'application/json')
    xmlhttp.setRequestHeader('Accept', 'application/json')
    xmlhttp.onreadystatechange = function () {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          let res = {}
          try {
            res = JSON.parse(xmlhttp.responseText || '') || {}
          } catch (e) {
            res = {}
          }
          params.success && params.success(res)
        } else {
          params.fail && params.fail()
        }
      }
    }
    xmlhttp.send(stringify(params.data))
  }

  reportApi(params: any) {
    const url = params.url
    if (params.keepalive) {
      try {
        const headers = new Headers()
        headers.append('Content-Type', 'application/json')

        fetch(url, {
          method: 'POST',
          headers: headers,
          body: stringify(params.data)
        })
      } catch (e) {
        this.ajaxReport(params)
      }
    } else {
      this.ajaxReport(params)
    }
  }

  proxyError() {
    const that = this
    window.addEventListener(
      'error',
      function (e) {
        if (!e) return
        try {
          if (e.target && e.target instanceof Element) {
            const node = e.target
            if (node.tagName) {
              const parent = getParent(node).reverse()
              const current = getCurrentTagName(node)
              parent.push(current)
              that.pushTransformLog({
                eventType: '6',
                // 不要补全标签语法 <${current} >，在各个展示端会展示异常
                name: `Resource Load Error: <${current}`,
                timestamp: Date.now(),
                payloads: {
                  [evenTypeEnum['6']]: {
                    page: that.getCurrentPath(),
                    element: parent,
                    type: 'element'
                  }
                }
              })
              return
            }
          }

          if (e.error || e.message) {
            // JavaScript 运行时错误
            const { eventType, errStack } = parseError(
              e.error || e.message,
              that.logCore.getConfig().onlyReportErrors
            )
            that.pushTransformLog({
              eventType: eventType,
              name: errStack.message,
              timestamp: Date.now(),
              payloads: {
                [evenTypeEnum[eventType]]: {
                  page: that.getCurrentPath(),
                  stack: errStack.stack,
                  errorType: e.type,
                  filename: e.filename,
                  lineno: e.lineno,
                  colno: e.colno,
                  type: 'error'
                }
              }
            } as unknown as ErrorBeanModel | UNErrorBeanModel)
          }
        } catch (err) {}
      },
      true
    )

    window.addEventListener('unhandledrejection', function (e) {
      if (!e) return
      try {
        const error = e.reason
        const { eventType, errStack } = parseError(
          error,
          that.logCore.getConfig().onlyReportErrors
        )
        that.pushTransformLog({
          eventType: eventType,
          name: errStack.message,
          timestamp: Date.now(),
          payloads: {
            [evenTypeEnum[eventType]]: {
              req: error,
              page: that.getCurrentPath(),
              stack: errStack.stack,
              type: 'unhandledrejection'
            }
          }
        } as unknown as ErrorBeanModel | UNErrorBeanModel)
      } catch (err) {}
    })
  }

  proxyEvent() {
    const that = this
    window.addEventListener(
      'click',
      (e) => {
        try {
          if (that.logCore.getConfig().silentClick) return
          if (e.target) {
            const node = e.target as Element
            const parent = getParent(node).reverse()
            const current = getCurrentTagName(node)
            parent.push(current)
            that.pushTransformLog({
              eventType: '8',
              name: 'click <' + current + '>',
              timestamp: Date.now(),
              payloads: {
                [evenTypeEnum['8']]: {
                  page: that.getCurrentPath(),
                  element: parent
                }
              }
            })
          }
        } catch (e) {}
        return
      },
      true
    )
  }

  requestError(name: string) {
    return (xhr: any) => {
      if (!xhr._logs) return
      const beanKey = evenTypeEnum[7]
      xhr._logs.payloads[beanKey].error = true
      xhr._logs.payloads[beanKey].type = name
      xhr._logs.payloads[beanKey].duration =
        Date.now() - xhr._logs.payloads[beanKey].timestamp
      xhr._logs.payloads[beanKey].res = {
        httpCode: xhr.status,
        statusText: xhr.statusText
      }
      this.pushTransformLog(xhr._logs)
      const payload = xhr._logs.payloads[beanKey] || {}
      typeof this.initOptions?.requestAfterCallback === 'function' &&
        this.initOptions.requestAfterCallback({
          req: payload.req,
          res: {},
          type: name
        })
      xhr._logs = null
    }
  }

  xhrEnd(xhr: any) {
    const logs = xhr._logs
    if (!logs) return
    const beanKey = evenTypeEnum[7]
    const responseHeaders = formateHeaders(xhr)
    let responseData = xhr.response
    try {
      responseData = JSON.parse(responseData)
    } catch (e) {
      //忽略
    }
    if (xhr.status !== 200) {
      logs.payloads[beanKey].error = true
    }
    logs.payloads[beanKey].type = 'success'
    logs.status = xhr.status
    logs.payloads[beanKey].res = {
      data: responseData,
      httpCode: xhr.status,
      header: responseHeaders
    }
    logs.payloads[beanKey].netState = this.logCore.deviceInfo.netState
    logs.payloads[beanKey].duration = Date.now() - logs.timestamp
    this.pushTransformLog(logs)
    const payload = xhr._logs.payloads[beanKey] || {}
    typeof this.initOptions?.requestAfterCallback === 'function' &&
      this.initOptions.requestAfterCallback({
        req: payload.req,
        res: payload.res,
        type: 'success'
      })
    xhr._logs = null
  }

  proxyXhr() {
    const that = this
    const beanKey = evenTypeEnum[7]
    hookXhr({
      onerror: this.requestError('fail'),
      ontimeout: this.requestError('timeout'),
      onabort: this.requestError('abort'),
      open(args, xhr) {
        const method = args[0] || ''
        const fullUrl = args[1] || ''
        if (that.logCore.testSilentHttp(fullUrl) || that.inSetInterval) return
        const i = fullUrl.indexOf('?')
        const url = i > -1 ? fullUrl.slice(0, i) : fullUrl
        const params = i > -1 ? fullUrl.slice(i + 1) : ''
        xhr._logs = {
          eventType: '7',
          name: url,
          timestamp: Date.now(),
          payloads: {
            [beanKey]: {
              page: that.getCurrentPath(),
              req: {
                url,
                params,
                method,
                header: {}
              }
            }
          }
        }
      },
      send(args, xhr) {
        if (
          (!xhr.onreadystatechange && !xhr.onloadend && !xhr.onload) ||
          !xhr.onerror
        ) {
          xhr._logs = null
          return
        }
        xhr._logs && (xhr._logs.payloads[beanKey].req.data = args[0])
      },
      setRequestHeader(args, xhr) {
        xhr._logs && (xhr._logs.payloads[beanKey].req.header[args[0]] = args[1])
      },
      onloadend(xhr) {
        that.xhrEnd(xhr)
      },
      onload(xhr) {
        that.xhrEnd(xhr)
      },
      onreadystatechange(xhr) {
        if (!xhr || xhr.readyState !== 4) {
          return
        }
        if (
          xhr.status === 0 &&
          !(xhr.responseURL && xhr.responseURL.indexOf('file:') === 0)
        ) {
          return
        }
        that.xhrEnd(xhr)
      }
    })
  }

  protected getCurrentPath() {
    return this.currentPath || location.hash
      ? location.hash.slice(1).split('?')[0]
      : `/${location.pathname.split('/').slice(2).join('/')}`
  }

  isOffline() {
    return location.href.startsWith('file://') ? 1 : 2
  }

  pushTransformLog(log: LogItem) {
    if (log.payloads)
      log.payloads = Object.assign({}, log.payloads, {
        isOffline: this.isOffline()
      })
    this.logCore.pushLog(log)
  }

  unProxyXhr() {
    unHook()
  }
}

function getTagName(node: Element) {
  const tagName = node.tagName?.toLowerCase() || node.tagName || ''
  let className = ''
  if (node.className) {
    const classArr = node.className.split(' ').filter((v) => v !== '')
    if (classArr.length > 0) {
      className = '.' + classArr.join('.')
    }
  }
  return tagName + className
}

function getCurrentTagName(node: Element) {
  const attributes = node.attributes
  const tagName = node.tagName?.toLowerCase() || node.tagName || ''
  const attrs = [tagName]
  if (attributes && attributes.length > 0) {
    for (let i = 0; i < attributes.length; i++) {
      attrs.push(attributes[i].name + '="' + attributes[i].value + '"')
    }
  }
  return attrs.join(' ')
}

function getParent(node: Element, n = 20) {
  let parent = node.parentNode as Element
  let index = 0
  const res = []
  while (parent && index < n) {
    const name = getTagName(parent)
    if (name) {
      res.push(name)
    }
    parent = parent.parentNode as Element
    index++
  }
  return res
}

export default new ReportLog()
