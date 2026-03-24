export class ManifestNotFoundError extends Error {
  constructor(uri: string, stack: string | undefined) {
    super('');
    this.message = `Manifest not found: ${uri}`;
    this.stack = stack;
  }
}

export class UnexpectedFileError extends Error {
  constructor(name: string) {
    super('');
    this.message = `Unexpected file with name ${name}`;
  }
}

export class FetchFileError extends Error {
  constructor(uri: string, stack: string | undefined) {
    super('');
    this.message = `Fetch file error: ${uri}`;
    this.stack = stack;
  }
}

export class DecryptFileError extends Error {
  constructor(fileName: string, stack: string | undefined) {
    super('');
    this.message = `Decrypt file error: ${fileName}`;
    this.stack = stack;
  }
}

export class ConfigureError extends Error {
  constructor(param: string) {
    super('');
    this.message = `Cdn url not set. Set param "${param}" in lib config`;
  }
}
