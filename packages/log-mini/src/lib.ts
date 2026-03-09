import type {
  Options,
  Character,
  Config,
  LogItem,
  ApiBeanModel
} from '../../log-core/src'
import {
  LogReportCoreSdk,
  errorStackParser,
  parseError,
  createVueErrorHandler,
  evenTypeEnum,
  type ErrorBeanModel,
  type UNErrorBeanModel,
  type LogItemMap,
  type PickBean,
  type ConsoleBeanModel
} from '../../log-core/src'
import { aop, setupAOP, callAOP } from './aop'
import type { QError } from '@omni-log/error'
import {
  getFrameworkAdapter,
  type FrameworkAdapter,
  Framework
} from './frameworkAdapter'

declare const __LOG_VERSION__: string

export type InitOptions = Omit<Options, 'originRequest'> & {
  setupAOP?: any
  aop?: any
  xcxCiUrl?: string
  framework?: Framework | `${Framework}`
  requestAfterCallback?: (data: {
    req: Record<string, any>
    res: Record<string, any>
    type: string
  }) => void
}

export default abstract class LogReportSdk {
  functionStack: string[]
  beforeFunctionStack: string[]
  initOptions: InitOptions | null
  sessionId: string
  // 只有进入页面后才调用，避免过早计算
  onLoaded: boolean
  isInitAop: boolean
  protected currentPath: string
  protected originRequest: Function
  protected frameworkAdapter: FrameworkAdapter
  vue2Plugin: { install: (...args: unknown[]) => void }
  vue3Plugin: { install: (...args: unknown[]) => void }
  useVueRouter: (router: unknown) => void

  logCore: LogReportCoreSdk
  constructor() {
    this.logCore = new LogReportCoreSdk()
    this.logCore.logVersion =
      typeof __LOG_VERSION__ !== 'undefined' ? __LOG_VERSION__ : undefined
    this.initOptions = null
    this.functionStack = []
    this.beforeFunctionStack = []
    this.onLoaded = false
    this.isInitAop = false
    this.currentPath = ''
    this.sessionId = ''
    this.originRequest = this.getJsApi().request
    this.frameworkAdapter = getFrameworkAdapter(Framework.UniApp)

    const that = this

    this.vue2Plugin = {
      install(Vue: any) {
        const originError = Vue.config.errorHandler
        const errorHandler = createVueErrorHandler(that, originError)
        Vue.config.errorHandler = errorHandler
      }
    }

    this.vue3Plugin = {
      install(app: any) {
        const originError = app.config.errorHandler
        const errorHandler = createVueErrorHandler(that, originError)
        app.config.errorHandler = errorHandler
      }
    }

    this.useVueRouter = function (router: any) {
      //
    }

    if (!this.isRepeatLoad()) {
      this.getRecordApi()
      this.rewriteRequest()
    }
  }

  init(options: InitOptions) {
    if (this.initOptions) {
      console.warn('已初始化过，请不要重复调用init函数')
      return
    }
    this.initOptions = options || {}

    if (options.framework) {
      this.frameworkAdapter = getFrameworkAdapter(options.framework)
    }

    this.initAop(options)

    this.sessionId = this.getSessionId()
    this.logCore.setParams({
      sessionId: this.sessionId
    })

    this.logCore.init(
      Object.assign({}, options, {
        originRequest: this.reportApi.bind(this)
      })
    )

    this.setSystemInfo()
    this.checkIDE()
  }

  initAop(options: Pick<InitOptions, 'setupAOP' | 'aop'>) {
    if (this.isInitAop) return
    this.isInitAop = true
    let _setupAOP = options.setupAOP
    let _aop = options.aop
    let flag = false

    if (!_setupAOP && !_aop) {
      flag = true
      _setupAOP = setupAOP
      _aop = aop
    }
    if (_setupAOP && _aop) {
      _setupAOP((hook: any) => {
        hook.app.add(this.proxyApp(_aop))
        hook.page.add(this.proxyPage(_aop))
        hook.component.add(this.proxyComponent(_aop))
      })
    }

    if (flag) {
      try {
        const originApp = App
        App = function (_options: any) {
          return originApp(callAOP('app', _options))
        }

        const originPage = Page
        Page = function (_options: any) {
          return originPage(callAOP('page', _options))
        }

        const originComponent = Component
        Component = function (_options: any) {
          return originComponent(callAOP('component', _options))
        }
      } catch (e) {}
    }
  }

  setConfig(config: Config) {
    this.logCore.setConfig(config)
  }

  getSessionId() {
    return this.logCore.getSessionId()
  }

  // 是否重复加载
  isRepeatLoad() {
    return false
  }

  // 用于重写
  abstract getJsApi(): any
  abstract reportApi(params: any): void

  // 用于重写
  abstract getComponentApi(): { created: string; destroyed: string }

  abstract setSystemInfo(): void
  abstract getRequestRes(res: any): {
    httpCode: Character
    header: any
    data: any
    errorMsg?: any
  }
  getRequestReqHeader(req: any = {}) {
    return req.header || {}
  }
  abstract getPagePath(i: any): string
  abstract getRecordApi(): void

  abstract checkIDE(): void

  abstract setXcxToolId(xcxCiSingleId: string | number): void
  abstract getXcxToolId(): Promise<string | number>

  abstract proxyComponent(aop: Function): any

  setXcxToolConfig(xcxCiSingleId: string | number) {
    if (xcxCiSingleId && this.initOptions?.xcxCiUrl) {
      this.logCore.priorityUrl = this.initOptions.xcxCiUrl
      this.logCore.logReportLimit = {
        interval: 300,
        num: 1,
        size: 10000000
      }
      this.logCore.setParams({
        xcxCiSingleId
      })
      this.logCore.isProd = true
      this.setXcxToolId(xcxCiSingleId)
    }
  }

  functionStackPop() {
    this.functionStack.pop()
  }

  functionStackPush(name: string) {
    this.functionStack.push(name)
    this.beforeFunctionStack.push(name)
    if (this.beforeFunctionStack.length > 50) {
      this.beforeFunctionStack = this.beforeFunctionStack.slice(-10)
    }
  }

  entryApp(options: any, type: string) {
    if (options && options.query) {
      const isFromXcxTool = options.query.isFromXcxTool
      if (isFromXcxTool) {
        this.getXcxToolId().then((val) => {
          this.setXcxToolConfig(val)
        })
      }
    }
  }

  pushLog<
    T extends LogItem,
    E extends T['eventType'],
    N extends T['name'],
    P extends LogItemMap[E]['payloads']
  >(eventType: E, name: N, payloads?: PickBean<P>) {
    this.logCore.pushLog({
      eventType,
      name,
      payloads: {
        [evenTypeEnum[eventType]]: payloads
      },
      timestamp: Date.now()
    } as LogItem)
  }

  lastReport() {
    this.logCore.lastReport()
  }

  rewriteCreate(type: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this
    let skipped = false
    return {
      before([e]: unknown[], name: any) {
        if (e && typeof e === 'object' && (e as any).type === '__l') {
          skipped = true
          return
        }
        skipped = false

        if (type === 'pageLifecycle') {
          _this.onLoaded = true
          if (name === 'onLoad') {
            _this.currentPath = _this.getPagePath(this)
          }
        }
        const payloads =
          type === 'pageLifecycle' && name === 'onLoad'
            ? { query: e, page: _this.getPagePath(this) }
            : e

        const realMethodName = _this.frameworkAdapter.extractMethodName(e, name)

        _this.pushLogsAll(payloads, realMethodName)
        _this.functionStackPush(realMethodName)
      },
      after(result: unknown) {
        if (!skipped) {
          _this.functionStackPop()
        }
        return result
      }
    }
  }

  normalProxy(type: string, shouldNew?: boolean) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this
    let skipped = false
    return {
      shouldNew,
      before: function ([e]: unknown[], name: any) {
        if (e && typeof e === 'object' && (e as any).type === '__l') {
          skipped = true
          return
        }
        skipped = false

        if (type === 'appLifecycle' && name === 'onLaunch') {
          ;(this as any).omni_log_mini_sessionId = _this.sessionId
          _this.currentPath = 'app'
          _this.entryApp(e, name)
        }

        const realMethodName = _this.frameworkAdapter.extractMethodName(e, name)

        if (!(name === 'onShow' && type === 'appLifecycle')) {
          const path = _this.getPagePath(this)
          const payloads =
            name === 'onShow' || name === 'onHide'
              ? { query: e, page: path }
              : name === 'onLaunch'
              ? { query: e, page: (e as Record<PropertyKey, any>)?.path }
              : e
          if (name === 'onShow' && type === 'pageLifecycle') {
            _this.currentPath = path
            _this.logCore.pushLogsAndAction('3', path, { query: e, page: path })
          } else {
            _this.pushLogsAll(payloads, realMethodName)
          }
        } else {
          const payloads = {
            query: e,
            page: (e as Record<PropertyKey, any>)?.path
          }
          _this.pushLogsAll(payloads, 'appOnShow')
        }
        _this.functionStackPush(realMethodName)
      },
      after: function (result: unknown) {
        if (!skipped) {
          _this.functionStackPop()
        }
        return result
      }
    }
  }

  pushLogsAll(e: any, name: string) {
    const lifecycleEventMap: Record<string, LogItem['eventType']> = {
      onLaunch: '1',
      appOnShow: '2',
      onShow: '3',
      onHide: '4',
      onLoad: '5'
    }
    const burstEvents = [
      'onPullDownRefresh',
      'onReachBottom',
      'onShareAppMessage'
    ]

    if (e && e.type === 'tap') {
      if (this.logCore.getConfig().silentClick) return
      this.logCore.pushLog({
        eventType: '8',
        name,
        timestamp: Date.now(),
        payloads: { [evenTypeEnum['8']]: { ...e, page: this.currentPath } }
      })
    } else if (
      name in lifecycleEventMap ||
      burstEvents.includes(name) ||
      name === 'appOnShow'
    ) {
      const eventType: LogItem['eventType'] = lifecycleEventMap[name] || '10'
      this.logCore.pushLog({
        eventType,
        name,
        timestamp: Date.now(),
        payloads: { [evenTypeEnum[eventType]]: e }
      } as LogItem)
    }
  }

  getError(args: unknown[]) {
    return Array.isArray(args) ? args[0] : ''
  }

  errorProxy() {
    return (args: unknown[]) => {
      const e = this.getError(args)
      // 因为小程序onError会把任何类型转成字符串，所以这里没法区分是否是Error类型
      const errStack = errorStackParser(e as any)
      this.logCore.pushLog({
        eventType: '6',
        name: errStack.message,
        timestamp: Date.now(),
        payloads: {
          [evenTypeEnum['6']]: {
            page: this.currentPath,
            stack: errStack.stack,
            type: 'error',
            beforeStack: this.beforeFunctionStack.slice(-10).join(',')
          }
        }
      })
    }
  }
  onUnhandledRejectionProxy() {
    return ([e]: { reason: string | QError<any> }[]) => {
      const { eventType, errStack } = parseError(
        e.reason,
        this.logCore.getConfig().onlyReportErrors,
        typeof e.reason === 'string'
      )
      this.logCore.pushLog({
        eventType: eventType,
        name: errStack.message,
        timestamp: Date.now(),
        payloads: {
          [evenTypeEnum[eventType]]: {
            req: e.reason,
            page: this.currentPath,
            stack: errStack.stack,
            beforeStack: this.beforeFunctionStack.slice(-10).join(','),
            type: 'unhandledrejection'
          }
        }
      } as unknown as ErrorBeanModel | UNErrorBeanModel)
    }
  }

  onPageNotFoundProxy() {
    return ([e]: { path: string; query: any; isEntryPage: boolean }[]) => {
      if (!this.initOptions?.disablePageNotFound) {
        this.logCore.pushLog({
          eventType: '6',
          name: 'PageNotFound: ' + e.path,
          timestamp: Date.now(),
          payloads: {
            [evenTypeEnum['6']]: {
              req: e,
              type: 'pageNotFound'
            }
          }
        })
      }
    }
  }

  proxyPage(aop: Function): any {
    return aop(
      {
        onLoad: this.rewriteCreate('pageLifecycle'),
        onShow: this.normalProxy('pageLifecycle'),
        onReady: this.normalProxy('pageLifecycle'),
        onHide: this.normalProxy('pageLifecycle'),
        onUnload: this.normalProxy('pageLifecycle'),
        onReachBottom: this.normalProxy('event'),
        onPullDownRefresh: this.normalProxy('event'),
        onShareAppMessage: this.normalProxy('event', false),
        onPageScroll: null
      },
      this.normalProxy('methods')
    )
  }

  proxyApp(aop: Function): any {
    return aop(
      {
        onLaunch: this.normalProxy('appLifecycle'),
        onShow: this.normalProxy('appLifecycle'),
        onHide: null,
        onError: this.errorProxy(),
        onUnhandledRejection: this.onUnhandledRejectionProxy(),
        onPageNotFound: this.onPageNotFoundProxy()
      },
      this.normalProxy('methods')
    )
  }

  warpUserApi(
    apis: string[] = [],
    config: Record<string, (log: LogItem, obj: any) => void>
  ) {
    apis.forEach((api) => {
      const originApi = this.getJsApi()[api]
      if (originApi && typeof originApi === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const _this = this
        this.hookDef(api, function (this: any, obj: any) {
          try {
            const now = Date.now()
            let beanKey = evenTypeEnum['9']
            const logsObj = {
              eventType: '9',
              name: api,
              timestamp: now,
              padding: true,
              payloads: {}
            } as ApiBeanModel
            if (config && config[api] && typeof config[api] === 'function') {
              config[api](logsObj as LogItem, obj)
              beanKey = evenTypeEnum[logsObj.eventType]
            }

            Object.assign(logsObj.payloads, {
              [beanKey]: {
                page: _this.currentPath,
                stack: _this.functionStack.join(','),
                req: obj,
                duration: 0,
                res: {},
                type: ''
              }
            })

            _this.logCore.pushLog(logsObj)
            let completeEd = false
            _this.rewriteObjectFn(obj, 'success', function () {
              if (!completeEd) logsObj.padding = false
              completeEd = true
              logsObj.payloads[beanKey].type = 'success'
              logsObj.payloads[beanKey].res = arguments
              logsObj.payloads[beanKey].duration = Date.now() - now
              _this.logCore.actionReportLogs()
            })
            _this.rewriteObjectFn(obj, 'fail', function (err: any) {
              if (!completeEd) logsObj.padding = false
              completeEd = true
              logsObj.payloads[beanKey].type = 'fail'
              logsObj.payloads[beanKey].res = err
              logsObj.payloads[beanKey].duration = Date.now() - now
              _this.logCore.actionReportLogs()
            })
            _this.rewriteObjectFn(obj, 'complete', function () {
              const d = Date.now() - now
              setTimeout(() => {
                if (completeEd) return
                logsObj.padding = false
                completeEd = true
                if (!logsObj.payloads[beanKey].type) {
                  logsObj.payloads[beanKey].res = arguments
                }
                logsObj.payloads[beanKey].type = 'timeout'
                logsObj.payloads[beanKey].duration = d
                _this.logCore.actionReportLogs()
              }, 3000)
            })
          } catch (e) {}
          const result = originApi.apply(this, arguments)
          return result
        })
      }
    })
  }

  moduleIsError(arr: any[] = []) {
    return arr.some((v) => {
      try {
        const json = JSON.parse(v.dataJson || '')
        return !json.success
      } catch (e) {
        return true
      }
    })
  }

  httpReport(arg0: any) {
    if (this.logCore.getConfig().silentHttpFineControl) return true
    return arg0 && arg0.reportLog
  }

  rewriteRequest() {
    const originRequest = this.originRequest
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const _this = this
    this.hookDef('request', function (this: any) {
      const now = Date.now()
      const arg0 = arguments[0] || {}
      // req 专用于日志上报数据，删除的success等回调函数
      const req = Object.assign({}, arg0, {
        header: _this.getRequestReqHeader(arg0),
        success: '',
        fail: '',
        complete: ''
      })
      try {
        const beanKey = evenTypeEnum[7]
        const logsObj: LogItem = {
          eventType: '7',
          name: arg0.url,
          timestamp: now,
          padding: true,
          payloads: {
            [beanKey]: {
              page: _this.currentPath,
              stack: _this.functionStack.join(','),
              req: req,
              duration: 0,
              res: {},
              networkAvailable: _this.logCore.deviceInfo.networkAvailable,
              netState: _this.logCore.deviceInfo.netState,
              type: 'fail'
            }
          }
        }
        let isPushLog = false
        let requestCountTimeFlag = false
        let requestTimeout = false
        if (_this.httpReport(arg0)) {
          isPushLog = true
          _this.logCore.pushLog(logsObj)
          setTimeout(() => {
            if (!requestCountTimeFlag) {
              requestCountTimeFlag = true
              requestTimeout = true
              logsObj.padding = false
              logsObj.payloads[beanKey].error = true
              logsObj.payloads[beanKey].type = 'timeout'
              _this.logCore.actionReportLogs()
              // 超时处理，reLaunch 期间 request 无效问题
              typeof _this.initOptions?.requestAfterCallback === 'function' &&
                _this.initOptions.requestAfterCallback({
                  req: req,
                  res: {},
                  type: 'timeout'
                })
            }
          }, (arg0.timeout || 30000) + 5000)
        }
        _this.rewriteObjectFn(arg0, 'success', function () {
          if (isPushLog && !requestTimeout) {
            if (!requestCountTimeFlag) {
              requestCountTimeFlag = true
              logsObj.padding = false
            }
            const res = arguments[0] || {}
            const data = res.data
            const logRes = _this.getRequestRes(res)
            logsObj.payloads[beanKey].res = logRes
            logsObj.status = logRes.httpCode
            if (logRes?.data?.code === 9999) {
              logRes.httpCode = 9999
              logsObj.status = 9999
            }
            if (logRes.httpCode !== 200) {
              logsObj.payloads[beanKey].error = true
            } else if (data && !data.success) {
              logsObj.payloads[beanKey].error = true
            }
            logsObj.payloads[beanKey].type = 'success'
            logsObj.payloads[beanKey].duration = Date.now() - now
            _this.logCore.actionReportLogs()
            typeof _this.initOptions?.requestAfterCallback === 'function' &&
              _this.initOptions.requestAfterCallback({
                req: req,
                res: logRes,
                type: 'success'
              })
          }
        })
        _this.rewriteObjectFn(arg0, 'fail', function (err: any) {
          if (err) err.url = arg0.url
          if (isPushLog && !requestTimeout) {
            if (!requestCountTimeFlag) {
              requestCountTimeFlag = true
              logsObj.padding = false
            }
            const logRes: Record<string, any> = _this.getRequestRes(err)
            logRes.errorData = err
            logsObj.payloads[beanKey].error = true
            logsObj.payloads[beanKey].res = logRes
            logsObj.payloads[beanKey].type = 'fail'
            logsObj.payloads[beanKey].duration = Date.now() - now
            _this.logCore.actionReportLogs()

            typeof _this.initOptions?.requestAfterCallback === 'function' &&
              _this.initOptions.requestAfterCallback({
                req: req,
                res: logRes,
                type: 'fail'
              })
          }
        })
      } catch (e) {}
      const result = originRequest.apply(this, arguments)
      if (result && typeof result.catch === 'function') {
        const oroginCatch = result.catch
        result.catch = function (callback: any) {
          return oroginCatch.call(this, (err: any) => {
            if (typeof err === 'object') {
              err.logAppendUrl = arg0.url
              return callback(err)
            } else {
              const newErr = {
                originError: err,
                logAppendUrl: arg0.url
              }
              return callback(newErr)
            }
          })
        }
      }
      return result
    })
  }

  rewriteObjectFn(obj: Record<string, Function>, k: string, fn: Function) {
    const origin = obj[k]
    obj[k] = function () {
      try {
        fn.apply(this, arguments)
      } catch (e) {}
      if (typeof origin === 'function') {
        return origin.apply(this, arguments)
      }
    }
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
          .join(' ') || this.currentPath
      this.logCore.pushLog({
        eventType,
        name,
        payloads: {
          [evenTypeEnum[eventType]]: {
            args,
            page: this.currentPath,
            type
          }
        },
        timestamp: Date.now()
      })
      return originFn.apply(target, args)
    }
  }

  hookDef(key: string, fn: Function) {
    Object.defineProperty(this.getJsApi(), key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: fn
    })
  }
}
