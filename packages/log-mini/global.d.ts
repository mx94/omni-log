declare module 'node:console' {
  global {
    interface Console {
      prod(message?: any, ...optionalParams: any[]): void
    }
  }
}
