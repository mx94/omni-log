import {
  getSessionId,
  filterIDNumber,
  filterMobile,
  parseJwtToken
} from './util'

import type {
  Character,
  Params,
  AppParams,
  AppParamsObject,
  ParamsObject,
  Config,
  LogItem,
  LogGroup,
  RemoteAppConfig,
  DeviceParams,
  Options,
  DeviceBeanModel,
  TransformFullLogItem,
  FullLogItem,
  LogItemMap,
  PickBean
} from './types'
import { evenTypeEnum } from './types'
// 上报接口最大错误次数，超过这个次数不再上报日志（避免接口问题或小程序没配置白名单导致的无限上报）
const MAX_REPORT_ERROR = 7

export class LogReportCoreSdk {
  logs: LogGroup[]
  functionStack: string[]
  beforeFunctionStack: string[]
  useParams: Params[]
  useAppParams: AppParams[]
  defaultParams: ParamsObject
  appId: Character
  domain: string
  priorityUrl: string
  config: Config
  paddingLogs: LogItem[]
  remoteAppConfig: RemoteAppConfig
  initPadding: Promise<boolean>
  deviceInfo: DeviceParams
  reportError: number
  index: number
  isProd: boolean
  checkDev: boolean
  originUrl: string
  /** 失败重试次数 */
  failureRetry: number
  initResolve: (value: boolean | PromiseLike<boolean>) => void
  isResolved: boolean
  protected logsTimer: any
  protected originRequest: Function | null
  logReportLimit: {
    interval: number
    num: number
    size: number
  }
  transformLogIng: boolean
  logVersion?: string
  constructor(options?: Options) {
    this.index = 0
    this.isResolved = false
    this.isProd = true
    this.checkDev = true
    this.reportError = 0
    this.originUrl = ''
    this.initResolve = () => {}
    this.initPadding = new Promise((resolve) => {
      this.initResolve = (res) => {
        this.isResolved = true
        resolve(res)
      }
    })
    this.paddingLogs = []
    this.failureRetry = 1

    this.deviceInfo = {}
    this.appId = ''
    this.domain = ''
    this.priorityUrl = ''
    this.originRequest = null
    this.remoteAppConfig = {}
    this.config = {
      silentHttp: false,
      silentClick: false,
      slientLog: false,
      silentElementError: true,
      silentHttpFineControl: false,
      onlyReportErrors: true
    }
    this.logs = []
    this.functionStack = []
    this.beforeFunctionStack = []
    // 功能参数
    this.useParams = []
    // 离线包功能参数
    this.useAppParams = []
    this.defaultParams = {} as ParamsObject
    this.logsTimer = null
    this.logReportLimit = {
      interval: 2000,
      num: 30,
      size: 1024 * 1024 * 6
    }
    this.transformLogIng = false
    if (options) {
      this.init(options)
    }
  }

  cancelReport() {
    // 上报接口失败次数过多
    if (this.reportError > MAX_REPORT_ERROR) return true
    // 禁用
    if (this.getConfig().slientLog) return true
    // 开发环境
    if (!this.isProd) return true
    return false
  }

  setConfig(config: Config) {
    Object.assign(this.config, config)
  }

  getConfig(): Config {
    return Object.assign({}, this.config, this.remoteAppConfig?.config)
  }

  setDeviceInfo(info: DeviceBeanModel['payloads']['DeviceBean']) {
    this.deviceInfo = info
    const beanKey = evenTypeEnum[14]
    this.resolvePaddingLog(() => {
      if (!this.getConfig().silentHttpHeaders) {
        this.fetchDeviceInfo(
          this.transformLog(
            this.getReqLog({
              eventType: '14',
              name: 'Device Info',
              payloads: {
                [beanKey]: info
              },
              timestamp: Date.now()
            })
          )
        )
      } else {
        this.pushLog({
          eventType: '14',
          name: 'Device Info',
          payloads: {
            [beanKey]: info
          },
          timestamp: Date.now()
        })
      }
    })
  }

  init(
    {
      originRequest,
      appId,
      params,
      appParams,
      config,
      domain,
      isDebug,
      isProd = true,
      checkDev = true,
      awaitConfig = true,
      failureRetry = 1
    } = {} as Options
  ) {
    this.isProd = isProd
    this.checkDev = checkDev
    this.appId = appId
    this.failureRetry = failureRetry
    if (isDebug) {
      this.originUrl = 'http://127.0.0.1:7001'
    }
    this.domain = domain || this.originUrl + '/log/pushLog'

    this.originRequest = originRequest
    if (params) {
      this.setParams(params)
    }
    if (appParams) {
      this.setAppParams(appParams)
    }
    if (config) {
      this.setConfig(config)
    }
    if (this.appId) {
      this.fetchConfig().then(() => {
        if (awaitConfig) {
          this.initResolve(true)
        }
      })
    }
    if (!(this.appId && awaitConfig)) {
      this.initResolve(true)
    }
  }

  testSilentHttp(url: string) {
    if (typeof url !== 'string') return true
    const config = this.getConfig()
    if (Array.isArray(config.silentHttp)) {
      return config.silentHttp.some(
        (reg) => reg && typeof reg.test === 'function' && reg.test(url)
      )
    } else {
      return !!config.silentHttp
    }
  }

  setParams(params: Params) {
    this.useParams.push(params)
  }

  setAppParams(params: AppParams) {
    this.useAppParams.push(params)
  }

  getSessionId() {
    return getSessionId()
  }

  desensitization(str: string) {
    return filterIDNumber(filterMobile(str))
  }

  getParams(obj: LogItem) {
    return this.useParams.reduce((res: ParamsObject, params) => {
      let p = params
      if (typeof params === 'function') {
        try {
          p = params(obj, res)
        } catch (e) {
          console.error(e)
        }
      }
      return Object.assign(res, p)
    }, Object.assign({}, this.defaultParams))
  }

  getAppParams(obj?: LogItem) {
    return this.useAppParams.reduce((res: AppParamsObject, params) => {
      let p = params
      if (typeof params === 'function') {
        try {
          p = params(obj || ({} as LogItem), res)
        } catch (e) {
          console.error(e)
        }
      }
      return Object.assign(res, p)
    }, {})
  }

  getReqLog(obj: LogItem) {
    const res = Object.assign(
      obj,
      this.getParams(obj),
      { appId: this.appId },
      this.logVersion ? { logVersion: this.logVersion } : {},
      Number(obj.eventType) === 6 ||
        Number(obj.eventType) === 14 ||
        Number(obj.eventType) === 13
        ? this.deviceInfo
        : null
    )
    if (res.payloads) Object.assign(res.payloads, this.getAppParams(obj))
    if (res.jwtToken && !res.loginId) {
      const sub = parseJwtToken(res.jwtToken)
      if (sub && sub.userId) {
        this.defaultParams.loginId = res.loginId = sub.userId
      } else if (sub && sub.workerId) {
        this.defaultParams.loginId = res.loginId = sub.workerId
      }
    }
    const time = parseInt(
      String((res.timestamp ? res.timestamp : Date.now()) / 1000)
    )
    res.id = time + '-' + getSessionId() + '-' + this.index++

    return res as FullLogItem
  }

  transformLog(req: FullLogItem) {
    this.transformLogIng = true
    const res = {} as TransformFullLogItem
    if (typeof req.payloads === 'object') {
      try {
        res.payloads = JSON.stringify(req.payloads)
      } catch (e) {
        res.payloads = JSON.stringify({ msg: 'json转换失败' })
      }
    } else if (!req.payloads) {
      res.payloads = ''
    }
    for (const k in req) {
      if (k === 'name') {
        res[k] = req[k]
        continue
      }
      // 删除无用的key节省数据空间
      if (
        req[k as keyof FullLogItem] === '' ||
        k === 'padding' ||
        k === 'payloads'
      ) {
        continue
      }
      res[k as keyof FullLogItem] =
        req[k as keyof FullLogItem] == null
          ? ''
          : req[k as keyof FullLogItem] + ''
    }
    if (res.payloads) {
      res.payloads = this.desensitization(res.payloads)
    }
    this.transformLogIng = false
    return res
  }

  pushLog(obj: LogItem) {
    if (!obj) return
    this.resolvePaddingLog(() => {
      if (this.cancelReport()) return
      if (obj.eventType + '' === '7' && this.testSilentHttp(obj.name)) return
      if (obj.eventType + '' === '8' && this.getConfig().silentClick) return

      if (
        obj.eventType + '' === '6' &&
        obj.payloads?.type === 'element' &&
        this.getConfig().silentElementError
      )
        return
      const reqLog = this.getReqLog(obj)
      if (reqLog.padding) {
        this.paddingLogs.push(reqLog)
        return
      }
      this.appendToGroup(reqLog)
      this.autoActionReportLogs()
    })
  }

  resolvePaddingLog(callback: Function) {
    if (this.isResolved) {
      callback()
    } else {
      this.initPadding.then(() => {
        callback()
      })
    }
  }

  appendToGroup(obj: FullLogItem) {
    try {
      const log = this.transformLog(obj)
      const lastGroup = this.logs[this.logs.length - 1]
      const size = log.payloads ? log.payloads.length * 3 : 3
      if (!lastGroup || lastGroup.done) {
        this.logs.push(this.createGroup({ log, size }))
      } else if (lastGroup.size + size > this.logReportLimit.size) {
        lastGroup.done = true
        this.logs.push(this.createGroup({ log, size }))
      } else {
        lastGroup.logs.push(log)
        lastGroup.size += size
        if (lastGroup.logs.length >= this.logReportLimit.num) {
          lastGroup.done = true
        }
      }
    } catch (e) {}
  }

  autoActionReportLogs() {
    // 当 n 秒内没有日志，将当前所有日志标记可以上报
    clearTimeout(this.logsTimer)
    this.logsTimer = setTimeout(() => {
      this.logs.forEach((group) => {
        if (group) {
          group.done = true
        }
      })
      this.reportGroup()
    }, this.logReportLimit.interval)
  }

  actionReportLogs() {
    this.handlePaddingLogs()
  }

  handlePaddingLogs() {
    this.paddingLogs = this.paddingLogs.filter((log) => {
      if (log.padding) {
        return true
      }
      this.appendToGroup(log)
    })
    this.autoActionReportLogs()
  }

  reportGroup(options?: { keepalive?: boolean }) {
    if (!this.getReportUrl()) return
    if (this.logs.length > 0) {
      Promise.all(
        this.logs
          .filter((group) => group && group.done && group.report === 'pre')
          .map((group) => {
            group.report = 'padding'
            return this.report(group, options).then(
              () => {
                group.report = 'done'
              },
              () => {
                group.failureRetry += 1
                if (group.failureRetry <= this.failureRetry) {
                  group.report = 'pre'
                }
              }
            )
          })
      )
        .then(() => {
          this.logs = this.logs.filter((g) => g.report !== 'done')
        })
        .catch((e) => {
          console.error(e)
        })
    }
  }

  lastReport() {
    this.reportGroup({ keepalive: true })
  }

  createGroup(
    { log, size } = {} as { log: TransformFullLogItem; size: number }
  ): LogGroup {
    return {
      logs: log ? [log] : [],
      size: size || 0,
      done: !!size && size > this.logReportLimit.size,
      report: 'pre',
      failureRetry: 0
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

  pushLogsAndAction<
    T extends LogItem,
    E extends T['eventType'],
    N extends T['name'],
    P extends LogItemMap[E]['payloads']
  >(eventType: E, name: N, payloads: PickBean<P>) {
    this.pushLog({
      eventType,
      name,
      timestamp: Date.now(),
      payloads: {
        [evenTypeEnum[eventType]]: payloads
      }
    } as LogItem)
  }

  getRequestParams(group: LogGroup) {
    const params = {
      __topic__: this.appId + '',
      __logs__: group.logs.slice()
    }
    return params
  }

  getReportUrl() {
    if (this.priorityUrl) return this.priorityUrl
    if (this.remoteAppConfig?.domain) {
      return this.remoteAppConfig.domain
    }
    return this.domain
  }

  report(group: LogGroup, options?: { keepalive?: boolean }) {
    return new Promise((resolve, reject) => {
      if (this.cancelReport()) {
        resolve(null)
        return
      }
      const url = this.getReportUrl()
      if (!url || !this.originRequest) {
        resolve(null)
        return
      }
      try {
        const req: any = {
          method: 'POST',
          url: url,
          data: this.getRequestParams(group),
          success(res: any) {
            resolve(res)
          },
          fail: () => {
            this.reportError++
            reject()
          }
        }

        if (options?.keepalive) {
          req.keepalive = true
        }

        this.originRequest(req)
      } catch (e) {}
    })
  }

  fetchConfig(): Promise<unknown> {
    return Promise.resolve({})
  }

  fetchDeviceInfo(info: TransformFullLogItem) {
    return new Promise((resolve) => {
      if (this.cancelReport()) return resolve(null)
      if (!this.originRequest || !this.appId) return resolve({})
      try {
        this.originRequest({
          method: 'POST',
          url: this.originUrl + '/log/reportSystem',
          data: { appId: this.appId, ...info },
          success: () => resolve({}),
          fail: () => resolve({})
        })
      } catch (e) {
        resolve({})
      }
    })
  }
}
