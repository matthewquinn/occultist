import { Buffer } from 'node:buffer';
import { FileData, FileInput } from "../types.ts";

export class DataURLPart implements FileData {

  #data: Uint8Array;
  #contentType: string;

  constructor(dataURL: string) {
    this.#contentType = dataURL.replace(/^data:/, '').split(';')[0];
    this.#data = new Uint8Array(Buffer.from(dataURL, 'base64url'));
  }
  
  async *[Symbol.asyncIterator]() {
    yield this.#data;    
  }

  arrayBuffer(): Promise<ArrayBufferLike> {
    return Promise.resolve(this.#data.buffer);
  }

  bytes(): Promise<Uint8Array> {
    return Promise.resolve(this.#data);
  }

  get size(): number | null {
    return this.#data.byteLength;
  }

  get type(): string | null {
    return this.#contentType;
  }

  get name(): string | null {
    return null;
  }

  get filename(): string | null {
    return null;
  }

}

export function fileTransformer(fileData: FileInput): FileData {
  if (typeof fileData === 'string') {
    return new DataURLPart(fileData);
  }

  return fileData;
}
