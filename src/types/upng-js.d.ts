declare module "upng-js" {
  interface DecodedImage {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    frames: number;
    data: Uint8Array;
    tabs: Record<string, Uint8Array>;
  }
  interface UPNGStatic {
    decode(data: Uint8Array | ArrayBuffer): DecodedImage;
    toRGBA8(img: DecodedImage): Uint8Array[];
    encode(
      imgs: Uint8Array[],
      w: number,
      h: number,
      cnum: number,
      dels: number[] | null,
    ): Uint8Array;
  }
  const UPNG: UPNGStatic;
  export default UPNG;
  export = UPNG;
}
