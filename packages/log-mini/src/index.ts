/*eslint node/no-missing-import: "off" */
import { getEnvPlatform } from '../../utils/src/index'
import AliLogReport from './ali'
import WxLogReport from './wx'
import LogReportSdk, { InitOptions } from './lib'
import { LogReportCoreSdk, createVueErrorHandler } from '../../log-core/src'
export { tryGetApp } from './util'
export {
  Framework,
  FrameworkAdapter,
  UniAppAdapter,
  TaroAdapter,
  getFrameworkAdapter
} from './frameworkAdapter'

export {
  getSessionId,
  filterIDNumber,
  filterMobile,
  parseJwtToken,
  wrapObjectCall
} from '../../log-core/src'

export {
  LogItem,
  LogGroup,
  Params,
  ParamsObject,
  DeviceParams,
  Character,
  Config,
  Options,
  RemoteAppConfig,
  AppParams,
  AppParamsObject,
  TransformFullLogItem,
  StackFrame,
  CommonObject,
  Payloads,
  RequiredFullLogItem,
  FullLogItem,
  LogItemMap,
  PageBeanModel,
  ErrorBeanModel,
  UNErrorBeanModel,
  HttpBeanModel,
  TapBeanModel,
  ApiBeanModel,
  ImportantFunctionBeanModel,
  ToastBeanModel,
  CustomBeanModel,
  AppStartBeanModel,
  DeviceBeanModel,
  JSBridgeBeanModel,
  PreFetchBeanModel,
  BridgeLogBeanModel,
  WhiteScreenBeanModel,
  PickBean,
  PickBeanObj,
  ConsoleBeanModel
} from '../../log-core/src'

function createLog() {
  const platform = getEnvPlatform()
  if (platform === 'ali') {
    return new AliLogReport()
  } else if (platform === 'wx') {
    return new WxLogReport()
  } else {
    console.warn(
      platform ? `不支持当前环境：${platform}` : '无法获取当前运行小程序环境'
    )
  }
}

export { createVueErrorHandler }
export default createLog()

export { AliLogReport, WxLogReport }

export { LogReportSdk, LogReportCoreSdk, InitOptions }
