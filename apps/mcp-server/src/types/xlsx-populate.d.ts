declare module "xlsx-populate" {
  export function fromFileAsync(path: string): Promise<any>;
  export function fromDataAsync(data: any): Promise<any>;
  export function fromBlankAsync(): Promise<any>;
  
  export interface Workbook {
    sheet(nameOrIndex: string | number): Sheet;
    sheets(): Sheet[];
    toFileAsync(path: string): Promise<void>;
    outputAsync(type?: string): Promise<Buffer | Uint8Array | ArrayBuffer | Blob>;
  }

  export interface Sheet {
    name(): string;
    name(name: string): this;
    cell(row: number, col: number): Cell;
    cell(address: string): Cell;
  }

  export interface Cell {
    value(): any;
    value(val: any): this;
  }
}
