declare module 'qrcode' {
  export function toString(text: string, options?: { type?: 'svg'; margin?: number; width?: number }): Promise<string>;
  const qrcode: { toString: typeof toString };
  export default qrcode;
}
