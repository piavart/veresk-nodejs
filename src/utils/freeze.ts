export function deepFreeze(source: any) {
  Object.freeze(source);

  Object.getOwnPropertyNames(source).forEach((prop) => {
    if (
      source.hasOwnProperty(prop) &&
      !Object.isFrozen(source[prop]) &&
      source[prop] !== null &&
      (typeof source[prop] === 'object' || typeof source[prop] === 'function')
    ) {
      deepFreeze(source[prop]);
    }
  });

  return source;
}
