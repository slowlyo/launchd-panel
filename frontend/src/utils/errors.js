/**
 * 提取可直接展示给用户的错误文案。
 */
export function getErrorMessage(error, fallback = '操作失败') {
  const visited = new Set();
  const pending = [error];

  while (pending.length > 0) {
    const current = pending.shift();

    // 字符串异常最接近真实报错，优先直接返回。
    if (typeof current === 'string') {
      const text = current.trim();
      if (text) {
        return text;
      }
      continue;
    }

    // 标准 Error 对象直接读取 message。
    if (current instanceof Error) {
      const text = current.message?.trim();
      if (text) {
        return text;
      }
    }

    // 非对象值没有更多可提取的信息。
    if (!current || typeof current !== 'object') {
      continue;
    }

    // 避免循环引用导致死循环。
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const candidates = [current.message, current.error, current.err, current.cause, current.reason];

    for (const candidate of candidates) {
      if (candidate) {
        pending.push(candidate);
      }
    }
  }

  return fallback;
}
