declare namespace parseMultipart {

  export type Part = {
    filename: string;
    type: string;
    data: string;
  };

  export function Parse(multipartBodyBuffer: Uint8Array, boundary: string): Part[];
  // headerValue should be in the format 'multipart/form-data; boundary=----WebKitFormBoundaryvm5A9tzU1ONaGP5B'
  export function getBoundary(headerValue: string): string;
  export function DemoData(): Uint8Array;

}

declare module "parse-multipart" {
  export default parseMultipart;
}
