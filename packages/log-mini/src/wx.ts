/*eslint node/no-missing-import: "off" */
import Log from './lib'

export default class reportSdk extends Log {
  constructor() {
    super()
  }

  getJsApi() {
    return wx
  }

  getComponentApi() {
    return {
      created: 'attached',
      destroyed: 'detached'
    }
  }

  getRecordApi() {
    return this.warpUserApi(
      [
        'showModal',
        'getWeRunData',
        'getLocation',
        'showToast',
        'navigateTo',
        'redirectTo',
        'navigateBack',
        'reLaunch',
        'switchTab',
        'makePhoneCall',
        'setClipboardData',
        'navigateToMiniProgram',
        'scanCode',
        'getSystemSetting',
        'getAppAuthorizeSetting',
        'getDeviceInfo',
        'getWindowInfo',
        'getAppBaseInfo',
        'chooseMedia'
      ],
      {
        showToast(log, req) {
          log.eventType = '11'
          log.name = req.title
        }
      }
    )
  }

  proxyComponent(aop: Function) {
    const propObj: any = {
      methods: aop(
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
    wx.setStorage({
      key: 'xcxToolId',
      data: id
    })
  }

  getXcxToolId(): Promise<string | number> {
    return new Promise((resolve) => {
      wx.getStorage({
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
      httpCode: res.statusCode,
      header: res.header,
      data: data,
      errorMsg: res.errorMessage
    }
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
        if (res.statusCode === 200) {
          params.success(res.data)
        } else {
          req.fail && req.fail()
        }
      }
    }
    this.originRequest(req)
  }

  checkIDE() {
    const isIDE = this.logCore.deviceInfo.brand === 'devtools'
    if (!this.logCore.isProd) return
    if (isIDE && this.logCore.checkDev) {
      console.warn(`【@omni-log/log-web】自动判断为IDE环境，已禁用日志上报`)
      this.logCore.isProd = false
    }
  }

  setSystemInfo() {
    const that = this
    // eslint-disable-next-line node/no-unsupported-features/es-builtins
    Promise.allSettled([getNetworkType()]).then((res) => {
      const info = {}
      if (res[0].status === 'fulfilled') {
        const networkInfo = res[0].value as any
        Object.assign(info, {
          netState: networkInfo.networkType,
          networkAvailable: networkInfo.networkType !== 'none'
        })
      }
      const deviceInfo = wx.getDeviceInfo()
      const windowInfo = wx.getWindowInfo()
      const appBaseInfo = wx.getAppBaseInfo()
      Object.assign(info, {
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        platform: deviceInfo.platform,
        SDKVersion: appBaseInfo.SDKVersion,
        system: deviceInfo.system,
        screenSize: `${windowInfo.screenWidth}*${windowInfo.screenHeight},${windowInfo.pixelRatio}`
      })

      that.logCore.setDeviceInfo(info)
      listenNetworkStatusChange()
      that.checkIDE()
    })
    function getNetworkType() {
      return new Promise((resolve) => {
        wx.getNetworkType({
          success: (networkInfo = {} as any) => {
            resolve(networkInfo)
          }
        })
      })
    }

    function listenNetworkStatusChange() {
      wx.onNetworkStatusChange((res: any) => {
        Object.assign(that.logCore.deviceInfo, {
          networkAvailable: res.networkType !== 'none',
          netState: res.networkType || 'unknown'
        })
      })
    }
  }
}
