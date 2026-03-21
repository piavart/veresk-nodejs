function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function matchesPartial<T>(value: T, matcher: Partial<T>): boolean {
  if (!isPlainObject(matcher)) {
    return value === matcher;
  }

  if (!isPlainObject(value)) {
    return false;
  }

  return Object.entries(matcher).every(([key, expected]) => {
    const actual = value[key];

    if (isPlainObject(expected)) {
      return matchesPartial(actual, expected as Partial<typeof actual>);
    }

    return actual === expected;
  });
}

export function filterCollection<T>(
  items: T[],
  matcher: Partial<T> | ((item: T) => boolean),
): T[] {
  const predicate =
    typeof matcher === 'function'
      ? matcher
      : (item: T) => matchesPartial(item, matcher);

  return items.filter(predicate);
}

export function findInCollection<T>(
  items: T[],
  matcher: Partial<T> | ((item: T) => boolean),
): T | undefined {
  const predicate =
    typeof matcher === 'function'
      ? matcher
      : (item: T) => matchesPartial(item, matcher);

  return items.find(predicate);
}

export function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

export function setByPath(
  target: Record<string, any> | any[],
  path: string,
  value: unknown,
) {
  const keys = path.split('.');
  let current: any = target;

  for (const [index, key] of keys.entries()) {
    const isLast = index === keys.length - 1;
    const normalizedKey =
      Array.isArray(current) && /^\d+$/.test(key) ? Number(key) : key;

    if (isLast) {
      current[normalizedKey] = value;
      return;
    }

    current = current[normalizedKey];
  }
}
