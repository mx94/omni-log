import type { StackFrame } from './parseStack'

export type Character = string | number

export interface CommonObject {
  timestamp: number
  name: string
  padding?: boolean
  status?: Character
  id?: string
}

export interface ParamsObject {
  sessionId?: string
  deviceId?: Character
  xcxCiSingleId?: Character
  lat?: Character
  lon?: Character
  openId?: Character
  loginId?: Character
  jwtToken?: string
  version?: string
  versionCode?: Character
  hostVersion?: Character
  isOffline?: 1
  logVersion?: string
}

export interface Options {
  originRequest: Function
  appId: Character
  domain?: string
  isDebug?: boolean
  checkDev?: boolean
  disablePageNotFound?: boolean
  isProd?: boolean
  config?: Config
  params?: Params
  appParams?: AppParams
  awaitConfig?: boolean
  failureRetry?: number
}

export interface RemoteAppConfig {
  config?: Config
  domain?: string
}

export interface DeviceParams {
  brand?: string
  model?: string
  platform?: string
  SDKVersion?: string
  system?: string
  /** 网络是否可用 */
  networkAvailable?: boolean
  /**
   * wifi：wifi网络
   * 2g：2g网络
   * 3g：3g网络
   * 4g：4g网络
   * 5g：5g网络
   * unknown：未知
   * none：无网络
   */
  netState?: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'
  screenSize?: string
}

export interface Config {
  slientLog?: boolean
  silentHttp?: boolean | RegExp[]
  silentClick?: boolean
  silentHttpHeaders?: boolean
  silentElementError?: boolean
  // 禁用之后，将对所有的http进行监听
  silentHttpFineControl?: boolean
  // 只上报Error类型错误（小程序同步无法区分）
  onlyReportErrors?: boolean
}

export type Params =
  | ParamsObject
  | ((log: LogItem, params?: ParamsObject | undefined) => ParamsObject)

export interface AppParamsObject {
  reportSessionId?: string
  traceId?: string
  startTimestamp?: number
}

export type AppParams =
  | AppParamsObject
  | ((log: LogItem, params?: AppParamsObject | undefined) => AppParamsObject)

export const evenTypeEnum = {
  '1': 'PageBean',
  '2': 'PageBean',
  '3': 'PageBean',
  '4': 'PageBean',
  '5': 'PageBean',
  '6': 'ErrorBean',
  '7': 'HttpBean',
  '8': 'TapBean',
  '9': 'ApiBean',
  '10': 'ImportantFunctionBean',
  '11': 'ToastBean',
  '12': 'CustomBean',
  '13': 'AppStartBean',
  '14': 'DeviceBean',
  '16': 'UNErrorBean',
  '25': 'JSBridgeBean',
  '26': 'PreFetchBean',
  '24': 'SDKBean',
  '27': 'BridgeLogBean',
  '28': 'ConsoleBean',
  '29': 'WhiteScreenBean'
} as const

export type LogItemMap = {
  '1': PageBeanModel
  '2': PageBeanModel
  '3': PageBeanModel
  '4': PageBeanModel
  '5': PageBeanModel
  '6': ErrorBeanModel
  '7': HttpBeanModel
  '8': TapBeanModel
  '9': ApiBeanModel
  '10': ImportantFunctionBeanModel
  '11': ToastBeanModel
  '12': CustomBeanModel
  '13': AppStartBeanModel
  '14': DeviceBeanModel
  '16': UNErrorBeanModel
  '25': JSBridgeBeanModel
  '26': PreFetchBeanModel
  '27': BridgeLogBeanModel
  '28': ConsoleBeanModel
  '29': WhiteScreenBeanModel
}

export type EvenType = typeof evenTypeEnum

export type LogItem =
  | PageBeanModel
  | ErrorBeanModel
  | UNErrorBeanModel
  | HttpBeanModel
  | TapBeanModel
  | ApiBeanModel
  | ImportantFunctionBeanModel
  | ToastBeanModel
  | CustomBeanModel
  | AppStartBeanModel
  | DeviceBeanModel
  | JSBridgeBeanModel
  | PreFetchBeanModel
  | BridgeLogBeanModel
  | WhiteScreenBeanModel
  | ConsoleBeanModel

export type FullLogItem = LogItem & Params & ParamsObject & DeviceParams

export type RequiredFullLogItem = Required<
  Omit<FullLogItem, 'payloads'> & { payloads?: string }
>
export type TransformFullLogItem = {
  [K in keyof RequiredFullLogItem]: string
}

export interface LogGroup {
  logs: TransformFullLogItem[]
  size: number
  /**
   * 准备完成可以上报当前group
   */
  done: boolean
  /**
   * 上报完成，可以删除当前group
   */
  report: 'pre' | 'padding' | 'done'
  /** 失败次数 */
  failureRetry: number
}

export type Payloads<T> = {
  traceId?: string
  type?: string
  isOffline?: 1 | 2
} & T

export interface PageBeanModel extends CommonObject {
  eventType: '1' | '2' | '3' | '4' | '5'
  name: string
  payloads: Payloads<{
    PageBean: {
      query?: unknown
      page: string
    }
  }>
}

export interface ErrorBeanModel extends CommonObject {
  eventType: '6'
  name: string
  payloads: Payloads<{
    ErrorBean: {
      page?: string
      req?: any
      /**
       * error（可捕获代码错误）
       * vue （hook内报错）
       * unhandledrejection
       * pageNotFound（页面找不到）
       * element(资源加载异常)
       */
      type:
        | 'error'
        | 'vue'
        | 'unhandledrejection'
        | 'pageNotFound'
        | 'element'
        | 'target'
      file?: any
      info?: any
      element?: string[]
      stack?: StackFrame[] | string[]
      beforeStack?: string
    }
  }>
}

export interface UNErrorBeanModel extends CommonObject {
  eventType: '16'
  payloads: Payloads<{
    UNErrorBean: any
  }>
}

export interface HttpBeanModel extends CommonObject {
  eventType: '7'
  /** url */
  name: string
  payloads: Payloads<{
    HttpBean: {
      page: string
      req: any
      res: any
      stack?: string
      error?: boolean
      duration: number
      /** 网络是否可用 */
      networkAvailable?: boolean
      netState: DeviceParams['netState']
      /**
       * success：接口有响应
       * fail：接口发出请求失败
       * timeout：超时
       * pageNotFound：取消请求
       */
      type: 'success' | 'fail' | 'timeout' | 'abort'
    }
  }>
}

export interface TapBeanModel extends CommonObject {
  eventType: '8'
  /** 点击函数名 或者 节点信息 */
  name: string
  payloads: Payloads<{
    TapBean:
      | Event
      | {
          page: string
          element?: string[]
        }
  }>
}

export interface ApiBeanModel extends CommonObject {
  eventType: '9'
  /** api名称 */
  name: string
  payloads: Payloads<{
    ApiBean: {
      req: any
      res: any
      type: 'success' | 'fail' | 'timeout'
      page: string
      duration: number
      stack?: string
    }
  }>
}

export interface ImportantFunctionBeanModel extends CommonObject {
  eventType: '10'
  /** api名称 */
  name: 'onPullDownRefresh' | 'onReachBottom' | 'onShareAppMessage'
  payloads: Payloads<{
    ImportantFunctionBean?: any
  }>
}

export interface ToastBeanModel extends CommonObject {
  eventType: '11'
  /** 内容 */
  name: string
  payloads: Payloads<{
    ToastBean: ApiBeanModel['payloads']['ApiBean']
  }>
}

export interface CustomBeanModel extends CommonObject {
  eventType: '12'
  name: string
  payloads: Payloads<{
    CustomBean?: unknown
  }>
}

export interface AppStartBeanModel extends CommonObject {
  eventType: '13'
  /** 页面路径 */
  name: string
  payloads: Payloads<{
    AppStartBean: {
      REDIRECT: number
      DNS: number
      TCP: number
      TLS: number
      REQ: number
      RES: number
      DOM_LOADED: number
      DOM_COMPLETE: number
      READY: number
      LOAD: number
      BRIDGE?: number
    }
  }>
}

export interface DeviceBeanModel extends CommonObject {
  eventType: '14'
  name: 'Device Info'
  payloads: Payloads<{
    DeviceBean: DeviceParams
  }>
}

export interface JSBridgeBeanModel extends CommonObject {
  eventType: '25'
  /** 插件名 */
  name: string
  payloads: Payloads<{
    JSBridgeBean: {
      status: 'fulfilled' | 'rejected' | 'timeout'
      type: 'sync' | 'async'
      args: unknown[]
      res: unknown
      /** 插件名 */
      key: string
    }
  }>
}

export interface PreFetchBeanModel extends CommonObject {
  eventType: '26'
  /** 插件名 */
  name: string
  payloads: Payloads<{
    PreFetchBean: {
      type: number
      preFetchKey: string
      data: any
    }
  }>
}

export interface BridgeLogBeanModel extends CommonObject {
  eventType: '27'
  name: string
  payloads: Payloads<{
    BridgeLogBean: {
      type:
        | 'START_JS_BRIDGE_CALL'
        | 'END_JS_BRIDGE_CALL'
        | 'ERROR_JS_BRIDGE_CALL'
      logKey: string
      fnName: string
      duration: any
      extra: any
    }
  }>
}

export interface WhiteScreenBeanModel extends CommonObject {
  eventType: '29'
  name: string
  payloads: Payloads<{
    WhiteScreenBean: {
      type: number
    }
  }>
}

export interface ConsoleBeanModel extends CommonObject {
  eventType: '28'
  name: string
  payloads: Payloads<{
    ConsoleBean: {
      args: Parameters<Console['log' | 'warn' | 'error' | 'info']>
      page: string
      type: 'log' | 'warn' | 'error' | 'info' | 'prod'
    }
  }>
}

/** 拿出bean中对象的类型 */
export type PickBean<T> = {
  [K in keyof T[keyof PickBeanObj<T>]]: T[keyof PickBeanObj<T>][K]
}

/** 拿出payloads中的bean对象 */
export type PickBeanObj<T> = {
  [K in keyof T as T[K] extends Record<PropertyKey, any> ? K : never]: T[K]
}
