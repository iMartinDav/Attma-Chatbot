declare module 'pdfkit' {
  import { Readable } from 'stream';

  class PDFDocument extends Readable {
    constructor(options?: PDFKit.PDFDocumentOptions);
    addPage(options?: PDFKit.PDFDocumentOptions): this;
    text(
      text: string,
      x?: number,
      y?: number,
      options?: PDFKit.Mixins.TextOptions,
    ): this;
    image(
      src: string | Buffer,
      x?: number,
      y?: number,
      options?: PDFKit.Mixins.ImageOption,
    ): this;
    end(): void;
  }

  namespace PDFKit {
    interface PDFDocumentOptions {
      size?: string | [number, number];
      margin?: number;
      layout?: 'portrait' | 'landscape';
      info?: {
        Title?: string;
        Author?: string;
        Subject?: string;
        Keywords?: string;
        CreationDate?: Date;
        ModDate?: Date;
      };
    }

    namespace Mixins {
      interface TextOptions {
        width?: number;
        height?: number;
        ellipsis?: boolean | string;
        align?: 'left' | 'center' | 'right' | 'justify';
        indent?: number;
        columns?: number;
        columnGap?: number;
        lineBreak?: boolean;
        oblique?: boolean;
        underline?: boolean;
        strike?: boolean;
        link?: string;
        continued?: boolean;
      }

      interface ImageOption {
        width?: number;
        height?: number;
        scale?: number;
        fit?: [number, number];
        cover?: [number, number];
        align?: 'left' | 'center' | 'right';
        valign?: 'top' | 'center' | 'bottom';
      }
    }
  }

  export = PDFDocument;
}
