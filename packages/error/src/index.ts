class QError<T> extends Error {
  data: T
  code: string | undefined
  constructor(message: string, data?: T) {
    super(message)
    // 某些经过es6转es5会导致属性丢失
    Object.defineProperty(this, 'message', {
      configurable: true,
      enumerable: false,
      value: message,
      writable: true
    })

    Object.defineProperty(this, 'name', {
      configurable: true,
      enumerable: false,
      value: 'QError',
      writable: true
    })

    this.data = data as any

    if (Object.prototype.hasOwnProperty.call(Error, 'captureStackTrace')) {
      Error.captureStackTrace(this, this.constructor)
    } else {
      Object.defineProperty(this, 'stack', {
        configurable: true,
        enumerable: false,
        value: new Error(message).stack,
        writable: true
      })
    }
  }

  get isQError() {
    return true
  }

  static subclass(name: string, code?: string) {
    return class SubClassError<T> extends QError<T> {
      constructor(message: string, data?: T) {
        super(message, data)
        this.name = name
        this.code = code
      }
    }
  }
}
export default QError
export { QError }
/**
 * JSON.parse 错误
 */
export const JsonParseError = QError.subclass(
  'JsonParseError',
  'Q_JSON_PARSE_ERROR'
)

/**
 * JSON.stringify 错误
 */
export const JsonStringifyError = QError.subclass(
  'JsonStringifyError',
  'Q_JSON_STRINGIFY_ERROR'
)

/**
 * 业务请求错误
 */
export const RequestError = QError.subclass(
  'RequestError',
  'Q_BUSINESS_REQUEST_ERROR'
)
