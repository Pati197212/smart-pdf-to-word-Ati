
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from "docx";
import { StructuredDocument, DocElement } from "./types";

export async function generateWordDoc(data: StructuredDocument): Promise<Blob> {
  const children = data.elements.map((el: DocElement) => {
    switch (el.type) {
      case 'heading1':
        return new Paragraph({
          text: el.text || '',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        });
      case 'heading2':
        return new Paragraph({
          text: el.text || '',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 },
        });
      case 'list_item':
        return new Paragraph({
          text: el.text || '',
          bullet: { level: 0 },
          spacing: { after: 100 },
        });
      case 'table':
        if (!el.rows || el.rows.length === 0) return new Paragraph("");
        return new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: el.rows.map(row => new TableRow({
            children: row.map(cell => new TableCell({
              children: [new Paragraph(cell)],
            })),
          })),
        });
      case 'paragraph':
      default:
        return new Paragraph({
          children: [new TextRun(el.text || '')],
          spacing: { after: 200 },
        });
    }
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
  });

  return await Packer.toBlob(doc);
}
