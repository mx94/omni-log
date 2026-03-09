const CHROME_IE_STACK_REGEXP = /^\s*at .*(\S+:\d+|\(native\))/m
const SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code])?$/

export interface StackFrame {
  functionName?: string
  fileName?: string
  lineNumber?: string
  columnNumber?: string
}

export function createAnyParse(e: unknown) {
  return {
    message: e?.toString ? e.toString() : String(e),
    stack: []
  }
}

export function parseError(
  e: any,
  onlyReportErrors?: boolean,
  isError?: boolean
) {
  if (onlyReportErrors) {
    if (e instanceof Error || isError) {
      return {
        eventType: '6' as const,
        errStack: errorStackParser(e as any)
      }
    }

    let message: string
    if (typeof e === 'object' && e !== null) {
      message =
        e.errMsg ??
        e.msg ??
        e.message ??
        (() => {
          try {
            return JSON.stringify(e)
          } catch {
            return String(e)
          }
        })()
    } else {
      message = String(e)
    }

    return {
      eventType: '16' as const,
      errStack: { message, stack: [] }
    }
  }
  return {
    eventType: '6' as const,
    errStack: errorStackParser(e as any)
  }
}

/**
 * Given an Error object, extract the most information from it.
 */
export function errorStackParser(error: Error | string) {
  const res = { message: '', stack: [], originError: null } as {
    message: string
    stack: StackFrame[]
    originError: any
  }
  if (
    !(typeof error === 'string' || typeof error === 'object') ||
    error == null
  ) {
    res.message = String(error)
    return res
  }
  let stackString = ''
  if (typeof error === 'string') {
    stackString = error
  } else if (error.stack) {
    stackString = error.stack
  } else if (typeof error.message === 'string') {
    stackString = error.message
  }
  if (typeof error === 'object' && error.message) {
    res.message = error.message
  } else if (typeof error === 'object') {
    try {
      res.message = JSON.stringify(error)
    } catch {
      res.message = String(error)
    }
  } else {
    res.message = error as string
  }

  if (typeof res.message === 'object' || !res.message) {
    res.originError = res.message || error
  }

  res.message = getMessage(res.message)

  if (stackString.match(CHROME_IE_STACK_REGEXP)) {
    res.stack = parseV8OrIE(stackString)
  } else if (stackString.match(SAFARI_NATIVE_CODE_REGEXP)) {
    res.stack = parseFFOrSafari(stackString)
  }
  if (res.message === '') {
    res.message = 'empty'
  }
  return res
}

function getMessage(msg: unknown) {
  const message = String(msg)
  if (message.match(CHROME_IE_STACK_REGEXP)) {
    return findMessage(message, CHROME_IE_STACK_REGEXP)
  } else if (message.match(SAFARI_NATIVE_CODE_REGEXP)) {
    return findMessage(message, SAFARI_NATIVE_CODE_REGEXP)
  }
  return message
}

function findMessage(msg: string, reg: RegExp) {
  const res = []
  const msgArr: string[] = msg.split('\n')
  for (let i = 0; i < msgArr.length; i++) {
    const m = msgArr[i] || ''
    if (reg.test(m)) {
      return res.join('\n')
    }
    res.push(m)
  }
  return msg
}

// Separate line and column numbers from a string of the form: (URI:Line:Column)
function extractLocation(urlLike: string) {
  // Fail-fast but return locations like "(native)"
  if (urlLike.indexOf(':') === -1) {
    return [urlLike]
  }

  const regExp = /(.+?)(?::(\d+))?(?::(\d+))?$/
  const parts = regExp.exec(urlLike.replace(/[()]/g, '')) || []
  return [parts[1], parts[2] || '', parts[3] || '']
}
function parseV8OrIE(stack: string) {
  const filtered = stack.split('\n').filter(function (line) {
    return !!line.match(CHROME_IE_STACK_REGEXP)
  })

  return filtered.map(function (line): StackFrame {
    if (line.indexOf('(eval ') > -1) {
      // Throw away eval information until we implement stacktrace.js/stackframe#8
      line = line
        .replace(/eval code/g, 'eval')
        .replace(/(\(eval at [^()]*)|(,.*$)/g, '')
    }
    let sanitizedLine = line
      .replace(/^\s+/, '')
      .replace(/\(eval code/g, '(')
      .replace(/^.*?\s+/, '')

    // capture and preseve the parenthesized location "(/foo/my bar.js:12:87)" in
    // case it has spaces in it, as the string is split on \s+ later on
    const location = sanitizedLine.match(/ (\(.+\)$)/)

    // remove the parenthesized location from the line, if it was matched
    sanitizedLine = location
      ? sanitizedLine.replace(location[0], '')
      : sanitizedLine

    // if a location was matched, pass it to extractLocation() otherwise pass all sanitizedLine
    // because this line doesn't have function name
    const locationParts = extractLocation(
      location ? location[1] : sanitizedLine
    )
    const functionName = (location && sanitizedLine) || undefined
    const fileName =
      ['eval', '<anonymous>'].indexOf(locationParts[0]) > -1
        ? undefined
        : locationParts[0]

    return {
      functionName: functionName,
      fileName: fileName,
      lineNumber: locationParts[1],
      columnNumber: locationParts[2]
    }
  })
}
function parseFFOrSafari(stack: string) {
  const filtered = stack.split('\n').filter(function (line: string) {
    return !line.match(SAFARI_NATIVE_CODE_REGEXP)
  })

  return filtered.map(function (line: string): StackFrame {
    // Throw away eval information until we implement stacktrace.js/stackframe#8
    if (line.indexOf(' > eval') > -1) {
      line = line.replace(
        / line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,
        ':$1'
      )
    }

    if (line.indexOf('@') === -1 && line.indexOf(':') === -1) {
      // Safari eval frames only have function names and nothing else
      return {
        functionName: line
      }
    } else {
      const functionNameRegex = /((.*".+"[^@]*)?[^@]*)(?:@)/
      const matches = line.match(functionNameRegex)
      const functionName = matches && matches[1] ? matches[1] : undefined
      const locationParts = extractLocation(line.replace(functionNameRegex, ''))

      return {
        functionName: functionName,
        fileName: locationParts[0],
        lineNumber: locationParts[1],
        columnNumber: locationParts[2]
      }
    }
  })
}
