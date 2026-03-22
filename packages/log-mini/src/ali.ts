import Log from './lib'
import { tryGetApp } from './util'

export default class reportSdk extends Log {
  constructor() {
    super()
  }

  override getSessionId() {
    const app = tryGetApp()
    if (app && app.omni_log_mini_sessionId) {
      return app.omni_log_mini_sessionId
    }
    return super.getSessionId()
  }

  override isRepeatLoad() {
    const app = tryGetApp()
    return app && app.omni_log_mini_sessionId
  }

  override getError(args: unknown[]) {
    const [msg, stack] = Array.isArray(args) ? args : []
    return {
      message: msg,
      stack
    }
  }
  getJsApi() {
    return my
  }

  getComponentApi() {
    return {
      created: 'didMount',
      destroyed: 'didUnmount'
    }
  }

  proxyComponent(aop: Function) {
    const propObj: any = {
      methods: aop(
        {},
        (() => {
          let skipped = false
          return {
            before: ([e]: unknown[], name: string) => {
              if (e && typeof e === 'object' && (e as any).type === '__l') {
                skipped = true
                return
              }
              skipped = false

              const realMethodName = this.frameworkAdapter.extractMethodName(
                e,
                name as string
              )
              this.pushLogsAll(e, realMethodName)
              this.functionStackPush(realMethodName)
            },
            after: (result: unknown) => {
              if (!skipped) {
                this.functionStackPop()
              }
              return result
            }
          }
        })()
      )
    }

    const componentApi = this.getComponentApi()

    if (componentApi.created) {
      propObj[componentApi.created] = this.rewriteCreate('componentLifecycle')
    }
    if (componentApi.destroyed) {
      propObj[componentApi.destroyed] = this.normalProxy('componentLifecycle')
    }

    return aop(propObj)
  }

  setXcxToolId(id: string | number) {
    my.setStorage({
      key: 'xcxToolId',
      data: id
    })
  }

  getXcxToolId(): Promise<string | number> {
    return new Promise((resolve) => {
      my.getStorage({
        key: 'xcxToolId',
        complete(res: any) {
          resolve(res.data)
        }
      })
    })
  }

  getPagePath(page: any) {
    return page.route || page.is
  }

  getRequestRes(res: any = {}) {
    let data = {}
    if (typeof res.data === 'object') {
      try {
        data = JSON.parse(JSON.stringify(res.data))
      } catch (e) {
        data = res.data
      }
    }
    return {
      httpCode: res.status,
      header: res.headers,
      data: data || {},
      errorMsg: res.errorMessage
    }
  }

  override getRequestReqHeader(req: any = {}) {
    return req.headers || {}
  }

  getRecordApi() {
    return this.warpUserApi(
      [
        'confirm',
        'chooseCity',
        'getLocation',
        'showToast',
        'navigateTo',
        'redirectTo',
        'navigateBack',
        'reLaunch',
        'switchTab',
        'makePhoneCall',
        'setClipboard',
        'navigateToMiniProgram',
        'scanCode'
      ],
      {
        showToast(log, req) {
          log.eventType = '11'
          log.name = req.content
        }
      }
    )
  }

  reportApi(params: any) {
    const req: any = {
      url: params.url,
      method: params.method,
      data: params.data
    }
    if (typeof params.fail === 'function') {
      req.fail = params.fail
    }
    if (typeof params.success === 'function') {
      req.success = (res: any) => {
        if (res.status === 200) {
          params.success(res.data)
        } else {
          req.fail && req.fail()
        }
      }
    }
    this.originRequest(req)
  }

  checkIDE() {
    if (!this.logCore.isProd) return
    const isIDE = my.isIDE
    if (isIDE && this.logCore.checkDev) {
      console.warn(`【@omni-log/log-mini】自动判断为IDE环境，已禁用日志上报`)
      this.logCore.isProd = false
    }
  }

  setSystemInfo() {
    const that = this
    // eslint-disable-next-line node/no-unsupported-features/es-builtins
    Promise.allSettled([getSystemInfo(), getNetworkType()]).then((res) => {
      const info = {}
      if (res[0].status === 'fulfilled') {
        const systemInfo = res[0].value as any
        Object.assign(info, {
          model: systemInfo.model,
          brand: systemInfo.brand,
          platform: systemInfo.platform,
          SDKVersion: my.SDKVersion,
          system: systemInfo.system,
          screenSize: `${systemInfo.screenWidth}*${systemInfo.screenHeight},${systemInfo.pixelRatio}`
        })
      }
      if (res[1].status === 'fulfilled') {
        const networkInfo = res[1].value as any
        Object.assign(info, {
          netState: networkInfo.networkType,
          networkAvailable: networkInfo.networkAvailable
        })
      }
      that.logCore.setDeviceInfo(info)
      listenNetworkStatusChange()
    })
    function getSystemInfo() {
      return new Promise((resolve) => {
        my.getSystemInfo({
          success: (systemInfo = {} as any) => {
            resolve(systemInfo)
          }
        })
      })
    }
    const networkMap = {
      NOTREACHABLE: 'none',
      UNKNOWN: 'unknown',
      WWAN: 'wifi',
      WIFI: 'wifi',
      '2G': '2g',
      '3G': '3g',
      '4G': '4g',
      '5G': '5g'
    }
    function getNetworkType() {
      return new Promise((resolve) => {
        my.getNetworkType({
          success: (networkInfo = {} as any) => {
            networkInfo.networkType =
              networkMap[networkInfo.networkType as keyof typeof networkMap] ||
              'unknown'
            resolve(networkInfo)
          }
        })
      })
    }

    function listenNetworkStatusChange() {
      my.onNetworkStatusChange((res: any) => {
        Object.assign(that.logCore.deviceInfo, {
          networkAvailable: res.networkAvailable,
          netState:
            networkMap[res.networkType as keyof typeof networkMap] || 'unknown'
        })
      })
    }
  }
}
