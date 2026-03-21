export class ManifestNotFoundError extends Error {
  constructor(uri: string, stack: string | undefined) {
    super('');
    this.message = `Manifest not found: ${uri}`;
    this.stack = stack;
  }
}

export class UnexpectedSettingError extends Error {
  constructor(name: string) {
    super('');
    this.message = `Unexpected setting with name ${name}`;
  }
}

export class FetchSettingError extends Error {
  constructor(uri: string, stack: string | undefined) {
    super('');
    this.message = `Fetch setting error: ${uri}`;
    this.stack = stack;
  }
}

export class DecryptSettingError extends Error {
  constructor(settingName: string, stack: string | undefined) {
    super('');
    this.message = `Decrypt setting error: ${settingName}`;
    this.stack = stack;
  }
}

export class ConfigureError extends Error {
  constructor(param: string) {
    super('');
    this.message = `Cdn url not set. Set param "${param}" in lib config`;
  }
}
