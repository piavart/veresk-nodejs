export class Setting {
  constructor(
    public readonly name: string,
    public readonly etag: string,
    public readonly data: any,
  ) {}
}
