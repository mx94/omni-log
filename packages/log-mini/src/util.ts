let app: any = null

export function tryGetApp() {
  if (app) return app
  try {
    app = getApp()
  } catch (e) {}
  return app
}
