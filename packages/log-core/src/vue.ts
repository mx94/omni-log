import { parseError } from './parseStack'
import {
  evenTypeEnum,
  type ErrorBeanModel,
  type UNErrorBeanModel
} from './types'
import type { LogReportCoreSdk } from './core'
export function createVueErrorHandler(
  logSdk: { logCore: LogReportCoreSdk },
  originError: undefined | (() => void)
): (err: any, vm: any, info: any) => void {
  return function errorHandler(err: any, vm: any, info: any) {
    try {
      const file = getComponentName(vm)
      const { eventType, errStack } = parseError(
        err,
        logSdk.logCore.getConfig().onlyReportErrors
      )
      let page = ''
      try {
        page = location.href
      } catch (e) {
        page = vm.route
      }
      const key = evenTypeEnum[eventType]
      logSdk.logCore.pushLog({
        eventType: eventType,
        name: errStack.message,
        timestamp: Date.now(),
        payloads: {
          [key]: {
            req: err,
            file: file,
            page: page,
            stack: errStack.stack,
            type: 'vue',
            info
          }
        }
      } as unknown as ErrorBeanModel | UNErrorBeanModel)
    } catch (e) {}

    if (typeof originError === 'function') {
      originError()
    }

    console.error(err)
  }
}

function getComponentName(com: any) {
  if (!com) {
    return 'Anonymous'
  }
  if (com.$options && com.$options.__file) {
    return com.$options.__file
  }
  return null === com.$parent
    ? 'App'
    : com.$options && com.$options.name
    ? com.$options.name
    : 'Anonymous'
}
