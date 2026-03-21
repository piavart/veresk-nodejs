import { TManifest } from '../interfaces';

export class Manifest {
  public readonly contentPath: string;

  constructor(public readonly etag: string, public readonly data: TManifest) {
    this.contentPath = this.buildContentPath();
  }

  protected buildContentPath() {
    if (!this.data.length) {
      return '';
    }

    const uriArr = this.data[0].key
      .trim()
      .split('/')
      .filter((ur) => !!ur);
    uriArr.pop();

    return `/${uriArr.join('/')}`;
  }
}
