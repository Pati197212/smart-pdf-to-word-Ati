
export interface DocElement {
  type: 'paragraph' | 'heading1' | 'heading2' | 'list_item' | 'table';
  text?: string;
  rows?: string[][];
}

export interface StructuredDocument {
  elements: DocElement[];
}

export type ConversionStatus = 'idle' | 'processing' | 'generating' | 'completed' | 'error';

export interface FileData {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
}
