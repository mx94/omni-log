export enum Framework {
  UniApp = 'uniapp',
  Taro = 'taro'
}

export abstract class FrameworkAdapter {
  abstract extractMethodName(e: any, originalName: string): string
}

export class UniAppAdapter extends FrameworkAdapter {
  extractMethodName(e: any, originalName: string): string {
    if (!e || !e.type) {
      return originalName
    }

    try {
      const eventOpts = e.currentTarget?.dataset?.eventOpts
      const methodNames = this.extractUniappMethodNames(eventOpts, e.type)

      if (methodNames.length > 0) {
        return methodNames.join(',')
      }

      if (e._relatedInfo) {
        const text =
          e._relatedInfo.anchorTargetText || e._relatedInfo.anchorRelatedText
        if (text) {
          return text.substring(0, 50)
        }
      }
    } catch (err) {}

    return originalName
  }

  private extractUniappMethodNames(
    eventOpts: any,
    eventType: string
  ): string[] {
    if (!Array.isArray(eventOpts)) {
      return []
    }

    try {
      for (let i = 0; i < eventOpts.length; i++) {
        const eventItem = eventOpts[i]

        if (!Array.isArray(eventItem) || eventItem.length < 2) {
          continue
        }

        const [type, handlers] = eventItem

        // UniApp 自定义事件（$emit）会添加 ^ 前缀，需要同时匹配两种情况
        const isMatch = type === eventType || type === `^${eventType}`

        if (isMatch && Array.isArray(handlers)) {
          const methodNames: string[] = []

          for (let j = 0; j < handlers.length; j++) {
            const handler = handlers[j]

            if (Array.isArray(handler) && handler.length > 0) {
              const methodName = handler[0]
              if (typeof methodName === 'string') {
                methodNames.push(methodName)
              }
            }
          }

          return methodNames
        }
      }
    } catch (err) {}

    return []
  }
}

export class TaroAdapter extends FrameworkAdapter {
  extractMethodName(e: any, originalName: string): string {
    if (!e || !e.type) return originalName

    try {
      if (e._relatedInfo) {
        const text =
          e._relatedInfo.anchorTargetText || e._relatedInfo.anchorRelatedText
        if (text) return text.substring(0, 50)
      }
    } catch (err) {}

    return originalName
  }
}

export function getFrameworkAdapter(
  framework: Framework | string = Framework.UniApp
): FrameworkAdapter {
  if (framework === Framework.Taro) {
    return new TaroAdapter()
  }
  return new UniAppAdapter()
}
