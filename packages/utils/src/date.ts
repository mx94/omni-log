/**
 * 格式化日期
 * @param date - 日期对象
 * @param fmt - yyyy-MM-dd HH:mm:ss M 不补0，MM 补0，dd、HH、mm、ss 类似
 */
export function dateFormat(
  date: Date | number | string,
  fmt = 'yyyy-MM-dd HH:mm:ss'
): string {
  // 时间格式化
  if (!date) {
    return ''
  }
  if (!(date instanceof Date)) {
    date = new Date(typeof date === 'string' ? date.replace(/-/g, '/') : date)
  }
  const o: Record<string, number> = {
    'y+': date.getFullYear(),
    'M+': date.getMonth() + 1, // 月份
    'd+': date.getDate(), // 日
    'H+': date.getHours(), // 小时
    'm+': date.getMinutes(), // 分
    's+': date.getSeconds() // 秒
  }
  for (const k in o) {
    const reg = new RegExp(k)
    if (reg.test(fmt)) {
      const d = o[k]
      fmt = fmt.replace(reg, (s) => {
        if (s.length === 1) return d + ''
        return d < 10 ? '0' + d : d + ''
      })
    }
  }
  return fmt
}

/**
 * 格式化秒   input: 7320  return: 2小时2分钟
 * @param second - 秒
 */
export function secondFormat(second: number) {
  if (!second && second !== 0) {
    return ''
  }
  second = Number(second)
  if (second < 60) {
    return '1分钟'
  }
  const min = Math.floor(second % 3600)
  const hour = Math.floor(second / 3600)
  return hour > 0
    ? hour + '小时' + Math.floor(min / 60) + '分钟'
    : Math.floor(min / 60) + '分钟'
}
