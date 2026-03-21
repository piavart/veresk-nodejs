export class CdnUrlsProvider {
  private currentIndex = 0;

  constructor(public readonly cdnUrls: string[]) {
    if (!this.cdnUrls.length) {
      throw new Error('At least one CDN url should be provided');
    }
  }

  public getUrl(): string {
    return this.cdnUrls[this.currentIndex];
  }

  public switchUrl(): string {
    this.currentIndex = (this.currentIndex + 1) % this.cdnUrls.length;
    return this.getUrl();
  }
}
