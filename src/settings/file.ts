export class File<T = any> {
  constructor(
    public readonly name: string,
    public readonly etag: string,
    public readonly data: T,
  ) {}
}
