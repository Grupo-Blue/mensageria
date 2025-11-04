declare module 'qrious' {
  interface QRiousOptions {
    element?: HTMLCanvasElement | HTMLImageElement;
    background?: string;
    backgroundAlpha?: number;
    foreground?: string;
    foregroundAlpha?: number;
    level?: 'L' | 'M' | 'Q' | 'H';
    mime?: string;
    padding?: number;
    size?: number;
    value?: string;
  }

  export default class QRious {
    constructor(options?: QRiousOptions);
    background: string;
    backgroundAlpha: number;
    element: HTMLCanvasElement | HTMLImageElement;
    foreground: string;
    foregroundAlpha: number;
    level: string;
    mime: string;
    padding: number;
    size: number;
    value: string;
    toDataURL(mime?: string): string;
  }
}
