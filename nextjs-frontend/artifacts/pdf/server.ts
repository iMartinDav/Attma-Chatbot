import { chatModels } from '@/lib/ai/models';
import { myProvider } from '@/lib/ai/providers';
import { createDocumentHandler } from '@/lib/artifacts/server';
import { streamText } from 'ai';
import { jsPDF, type TextOptionsLight } from 'jspdf';
import { z } from 'zod';

// Enhanced typings with more precise formats
interface PDFSection {
  type: 'heading' | 'paragraph' | 'table' | 'figure';
  content: string;
  level?: 1 | 2 | 3; // For APA heading levels
  tableData?: {
    headers: string[];
    rows: string[][];
    caption?: string;
    notes?: string;
  };
  figureData?: {
    imageBase64?: string;
    caption: string;
  };
}

// Define document types for bioinformatics
type BioinformaticsDocType =
  | 'protocol'
  | 'report'
  | 'analysis'
  | 'review'
  | 'general';

// Document type-specific prompts with placeholder for title
const documentTemplates: Record<BioinformaticsDocType, string> = {
  protocol: `You are a professional bioinformatician creating a laboratory protocol. Create a detailed protocol document based on this title: "[TITLE_PLACEHOLDER]".
    Structure the document with:
    1. A clear protocol title
    2. A brief background/purpose (1 paragraph)
    3. Materials and equipment needed (as a list)
    4. Step-by-step procedure with numbered steps
    5. Expected results and troubleshooting tips
    6. References or notes
    
    Format your response:
    TITLE: [Your protocol title]
    INTRODUCTION: [Background and purpose]
    SECTION: Materials and Equipment
    [List of materials]
    SECTION: Procedure
    [Numbered steps]
    SECTION: Expected Results
    [Description]
    SECTION: Troubleshooting
    [Tips and solutions]
    CONCLUSION: [Final notes]`,

  report: `You are a professional bioinformatician creating a research report. Create a comprehensive analysis report based on this title: "[TITLE_PLACEHOLDER]".
    Structure the document with:
    1. A descriptive report title
    2. An executive summary (1 paragraph)
    3. Introduction with background information
    4. Methods section describing bioinformatics approaches used
    5. Results section with key findings
    6. Discussion and implications
    7. Conclusions
    
    Format your response:
    TITLE: [Your report title]
    INTRODUCTION: [Executive summary]
    SECTION: Background
    [Background information]
    SECTION: Methods
    [Bioinformatics methods used]
    SECTION: Results
    [Key findings]
    SECTION: Discussion
    [Interpretation and implications]
    CONCLUSION: [Final conclusions]`,

  analysis: `You are a professional bioinformatician creating a data analysis document. Create a thorough bioinformatics analysis based on this title: "[TITLE_PLACEHOLDER]".
    Structure the document with:
    1. A specific analysis title
    2. A data overview (1 paragraph)
    3. Preprocessing steps performed
    4. Analysis methodology
    5. Statistical approaches
    6. Results visualization guide
    7. Interpretation guidelines
    
    Format your response:
    TITLE: [Your analysis title]
    INTRODUCTION: [Data overview]
    SECTION: Preprocessing
    [Preprocessing steps]
    SECTION: Analysis Methodology
    [Description of methods]
    SECTION: Statistical Approach
    [Statistical details]
    SECTION: Results Interpretation
    [How to interpret results]
    CONCLUSION: [Summary of analysis]`,

  review: `You are a professional bioinformatician creating a literature review. Create a scholarly review based on this title: "[TITLE_PLACEHOLDER]".
    Structure the document with:
    1. A comprehensive review title
    2. An abstract summarizing the review (1 paragraph)
    3. Introduction to the field
    4. Current methodologies section
    5. Recent advances section
    6. Challenges and limitations
    7. Future directions
    
    Format your response:
    TITLE: [Your review title]
    INTRODUCTION: [Abstract]
    SECTION: Field Overview
    [Introduction to the field]
    SECTION: Current Methodologies
    [Description of methodologies]
    SECTION: Recent Advances
    [Recent developments]
    SECTION: Challenges and Limitations
    [Current challenges]
    CONCLUSION: [Future directions]`,

  general: `You are a professional bioinformatician. Create a well-structured scientific document based on this title: "[TITLE_PLACEHOLDER]".
    Structure the document with:
    1. A clear scientific title
    2. A brief introduction with context (1 paragraph)
    3. 3-5 main sections with appropriate technical headings
    4. Data-driven observations where applicable
    5. A conclusion with implications
    
    Format your response:
    TITLE: [Your scientific title]
    INTRODUCTION: [Introduction paragraph with context]
    SECTION: [Technical heading]
    [Content with scientific terminology]
    SECTION: [Technical heading]
    [Content]
    CONCLUSION: [Conclusion with implications]`,
};

// APA styling configuration
const apaStyle = {
  margins: {
    top: 25.4, // 1 inch in mm
    right: 25.4,
    bottom: 25.4,
    left: 25.4,
  },
  fonts: {
    title: { size: 16, style: 'bold' },
    heading1: { size: 14, style: 'bold' },
    heading2: { size: 12, style: 'bold' },
    heading3: { size: 12, style: 'bolditalic' },
    paragraph: { size: 12, style: 'normal' },
    tableCaption: { size: 12, style: 'italic' },
    tableHeader: { size: 11, style: 'bold' },
    tableCell: { size: 11, style: 'normal' },
    tableNote: { size: 10, style: 'italic' },
    footer: { size: 10, style: 'normal' },
  },
  colors: {
    text: [0, 0, 0], // Black
    heading: [0, 0, 0], // Black
    tableBorder: [0, 0, 0], // Black
    lightGray: [240, 240, 240],
    pageNumber: [100, 100, 100],
    headerText: [120, 120, 120], // Match "Generated by Genie" color
    footerText: [120, 120, 120], // Footer text color
  },
  spacing: {
    lineHeight: 1.1, // Further reduced from 1.2
    paragraphAfter: 5, // Further reduced from 8
    headingBefore: 8, // Reduced from 10
    headingAfter: 6, // Reduced from 8
    tableBefore: 8, // Reduced from 10
    tableAfter: 8, // Reduced from 10
    indentation: 12.7, // 0.5 inch paragraph indentation
  },
};

// Abstract document renderer for PDF
class APADocumentRenderer {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private contentWidth: number;
  private yPosition: number;
  private title: string;
  private runningHead: string;

  constructor(doc: jsPDF, title: string) {
    this.doc = doc;
    this.title = title;
    this.runningHead =
      title.length > 50 ? `${title.substring(0, 47)}...` : title;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.contentWidth =
      this.pageWidth - apaStyle.margins.left - apaStyle.margins.right;
    this.yPosition = apaStyle.margins.top;

    // Set document properties
    doc.setProperties({
      title: title,
      creator: 'Attma Bioinformatics Platform',
      subject: 'Scientific Document',
      keywords: 'bioinformatics, research',
    });
  }

  // Apply text styling
  private applyTextStyle(styleKey: keyof typeof apaStyle.fonts): void {
    const style = apaStyle.fonts[styleKey];
    this.doc.setFontSize(style.size);
    this.doc.setFont('times', style.style); // APA uses Times New Roman
  }

  // Apply color
  private applyColor(colorKey: keyof typeof apaStyle.colors): void {
    const color = apaStyle.colors[colorKey];
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  // Add "Generated by Genie" with date at bottom left of every page
  private addFooter(): void {
    this.doc.setFontSize(8).setFont('helvetica', 'italic');
    this.applyColor('footerText');
    this.doc.text(
      `Generated by Attma - ${new Date().toLocaleDateString()}`,
      apaStyle.margins.left,
      this.pageHeight - apaStyle.margins.bottom / 2,
    );
  }

  // Initialize the first page with simplified header (no "Running head:" prefix)
  public initializeDocument(): void {
    // Set up header on first page
    this.applyTextStyle('footer');
    this.applyColor('headerText'); // Use headerText color matching footer

    // Title in upper left
    this.doc.text(
      `${this.runningHead.toUpperCase()}`,
      apaStyle.margins.left,
      apaStyle.margins.top - 10,
    );

    // Page number in upper right
    this.doc.text(
      '1',
      this.pageWidth - apaStyle.margins.right,
      apaStyle.margins.top - 10,
      { align: 'right' },
    );

    // Add footer
    this.addFooter();

    // Start position for content
    this.yPosition = apaStyle.margins.top;
  }

  // Add page numbering to all pages
  public addPageNumbering(): void {
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);

      // Skip page 1 as it's already set up in initialize
      if (i > 1) {
        // Add running head and page number in header
        this.applyTextStyle('footer');
        this.applyColor('headerText');

        // Running head on left (APA style)
        this.doc.text(
          `${this.runningHead.toUpperCase()}`,
          apaStyle.margins.left,
          apaStyle.margins.top - 10,
        );

        // Page number on right
        this.doc.text(
          `${i}`,
          this.pageWidth - apaStyle.margins.right,
          apaStyle.margins.top - 10,
          { align: 'right' },
        );

        // Add footer
        this.addFooter();
      }
    }
  }

  // Replace the renderTitlePage method to work with the new approach
  public renderTitlePage(): void {
    // Initialize the document with proper APA header instead
    this.initializeDocument();
  }

  // Render text with error handling
  private renderText(
    text: string,
    x: number,
    y: number,
    options: TextOptionsLight = {},
    maxWidth?: number,
  ): { height: number } {
    try {
      const splitWidth = maxWidth || this.contentWidth;
      const lines = this.doc.splitTextToSize(text, splitWidth);
      this.doc.text(lines, x, y, options);
      return {
        height:
          lines.length *
          this.doc.getFontSize() *
          0.352 *
          apaStyle.spacing.lineHeight,
      };
    } catch (error) {
      console.error('Error rendering text:', error);
      return {
        height: this.doc.getFontSize() * 0.352 * apaStyle.spacing.lineHeight,
      };
    }
  }

  // Check if we need a new page
  private ensureSpace(neededSpace: number): void {
    if (
      this.yPosition + neededSpace >
      this.pageHeight - apaStyle.margins.bottom
    ) {
      this.doc.addPage();
      this.yPosition = apaStyle.margins.top;
    }
  }

  // Render a heading
  public renderHeading(content: string, level = 1): void {
    // Space before heading (not for first heading on page)
    if (this.yPosition > apaStyle.margins.top + 5) {
      this.yPosition += apaStyle.spacing.headingBefore;
    }

    // Ensure we have space
    this.ensureSpace(this.doc.getFontSize() * 1.5);

    // Apply style based on heading level
    const headingStyles = ['heading1', 'heading2', 'heading3'] as const;
    const styleKey = headingStyles[Math.min(level - 1, 2)];

    this.applyTextStyle(styleKey);
    this.applyColor('heading');

    // In APA, level 1 headings are centered
    const options: TextOptionsLight = level === 1 ? { align: 'center' } : {};
    const result = this.renderText(
      content,
      level === 1 ? this.pageWidth / 2 : apaStyle.margins.left,
      this.yPosition,
      options,
    );

    this.yPosition += result.height + apaStyle.spacing.headingAfter;
  }

  // Render a paragraph
  public renderParagraph(content: string): void {
    this.ensureSpace(this.doc.getFontSize() * 2); // Minimum space for at least one line

    this.applyTextStyle('paragraph');
    this.applyColor('text');

    // First paragraph after heading is not indented in APA
    // Check if last y position was after heading
    const shouldIndent =
      this.yPosition > apaStyle.margins.top + apaStyle.spacing.headingBefore;

    const result = this.renderText(
      content,
      shouldIndent
        ? apaStyle.margins.left + apaStyle.spacing.indentation
        : apaStyle.margins.left,
      this.yPosition,
    );

    this.yPosition += result.height + apaStyle.spacing.paragraphAfter;
  }

  // Render a table (APA style)
  public renderTable(tableData: PDFSection['tableData']): void {
    if (!tableData) return;

    const { headers, rows, caption } = tableData;
    if (headers.length === 0 || rows.length === 0) return;

    // Space before table (reduced)
    this.yPosition += apaStyle.spacing.tableBefore;
    this.ensureSpace(80); // Reduced from 100

    // Table number and caption (above table in APA)
    if (caption) {
      this.applyTextStyle('tableCaption');
      this.applyColor('text');
      this.renderText(
        `Table 1. ${caption}`,
        apaStyle.margins.left,
        this.yPosition,
      );
      this.yPosition += this.doc.getFontSize() * 1.2; // Reduced spacing
    }

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(headers, rows);
    const tableWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    const startX = apaStyle.margins.left;
    const cellPadding = 3; // Reduced from 5

    // APA tables have minimal borders - just horizontal rules
    this.doc.setLineWidth(0.3);
    this.doc.setDrawColor(0);

    // Draw top border
    this.doc.line(startX, this.yPosition, startX + tableWidth, this.yPosition);

    // Header row
    this.applyTextStyle('tableHeader');
    this.applyColor('text');

    let currentX = startX;
    let rowHeight = this.calculateRowHeight(headers, columnWidths, cellPadding);

    // Draw header content with reduced padding
    headers.forEach((header, i) => {
      const colWidth = columnWidths[i];
      this.renderText(
        header,
        currentX + cellPadding,
        this.yPosition + cellPadding + 2,
        {},
        colWidth - cellPadding * 2,
      );
      currentX += colWidth;
    });

    this.yPosition += rowHeight;

    // Draw header bottom border
    this.doc.line(startX, this.yPosition, startX + tableWidth, this.yPosition);

    // Draw data rows
    this.applyTextStyle('tableCell');

    rows.forEach((row, rowIdx) => {
      // Check if we need a new page
      rowHeight = this.calculateRowHeight(row, columnWidths, cellPadding);
      this.ensureSpace(rowHeight);

      // Draw row content
      currentX = startX;
      row.forEach((cell, i) => {
        if (i < columnWidths.length) {
          const colWidth = columnWidths[i];
          this.renderText(
            cell,
            currentX + cellPadding,
            this.yPosition + cellPadding + 1,
            {},
            colWidth - cellPadding * 2,
          ); // Adjusted vertical position
          currentX += colWidth;
        }
      });

      this.yPosition += rowHeight;

      // Last row has bottom border
      if (rowIdx === rows.length - 1) {
        this.doc.line(
          startX,
          this.yPosition,
          startX + tableWidth,
          this.yPosition,
        );
      }
    });

    // Always add a table note (either provided or default)
    const noteText =
      tableData.notes ||
      `Values represent analyzed data relevant to the ${this.title}. Statistics derived from standard bioinformatic protocols.`;
    this.applyTextStyle('tableNote');
    this.renderText(`Note. ${noteText}`, startX, this.yPosition + 6);

    // Space after table (reduced)
    this.yPosition += apaStyle.spacing.tableAfter;
  }

  // Calculate optimal column widths
  private calculateColumnWidths(headers: string[], rows: string[][]): number[] {
    const columnCount = headers.length;
    if (columnCount === 0) return [];

    // Analyze content width in each column
    const columnWidthsPixel: number[] = Array(columnCount).fill(0);

    // Use current font settings to measure widths
    this.applyTextStyle('tableHeader');
    for (const [i, header] of headers.entries()) {
      columnWidthsPixel[i] = Math.max(
        columnWidthsPixel[i],
        this.doc.getTextWidth(header),
      );
    }

    this.applyTextStyle('tableCell');
    for (const row of rows) {
      for (const [i, cell] of row.entries()) {
        if (i < columnWidthsPixel.length) {
          columnWidthsPixel[i] = Math.max(
            columnWidthsPixel[i],
            this.doc.getTextWidth(cell),
          );
        }
      }
    }

    // Calculate proportional widths
    const totalContentWidth = columnWidthsPixel.reduce(
      (sum, w) => sum + w,
      0,
    );
    const minColumnWidth = 30;

    let columnWidths = columnWidthsPixel.map((pixelWidth) => {
      const proportion =
        totalContentWidth > 0
          ? pixelWidth / totalContentWidth
          : 1 / columnCount;
      return Math.max(this.contentWidth * proportion, minColumnWidth);
    });

    // Adjust if total width exceeds content width
    const totalWidth = columnWidths.reduce((sum, w) => sum + w, 0);
    if (totalWidth > this.contentWidth) {
      const scaleFactor = this.contentWidth / totalWidth;
      columnWidths = columnWidths.map((w) => w * scaleFactor);
    }

    return columnWidths;
  }

  // Calculate row height based on content
  private calculateRowHeight(
    cells: string[],
    columnWidths: number[],
    padding: number,
  ): number {
    let maxLines = 1;

    cells.forEach((cell, i) => {
      if (i < columnWidths.length) {
        const cellWidth = columnWidths[i] - padding * 2;
        const lines = this.doc.splitTextToSize(cell, cellWidth).length;
        maxLines = Math.max(maxLines, lines);
      }
    });

    return (
      maxLines * this.doc.getFontSize() * apaStyle.spacing.lineHeight +
      padding * 2
    );
  }

  // Render document content
  public renderContent(sections: PDFSection[]): void {
    // Add title as the first main heading
    this.renderHeading(this.title, 1);

    // Render all sections
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      switch (section.type) {
        case 'heading':
          this.renderHeading(section.content, section.level || 1);
          break;

        case 'paragraph':
          this.renderParagraph(section.content);
          break;

        case 'table':
          this.renderTable(section.tableData);
          break;
      }
    }

    // Add final page numbering
    this.addPageNumbering();
  }
}

// Content generation function
async function generatePDFContent(
  title: string,
  docType: BioinformaticsDocType = 'general',
): Promise<{ title: string; sections: PDFSection[] }> {
  let fullContent = '';
  try {
    // Select the appropriate template based on document type and replace the title placeholder
    const templateWithTableSupport = `${documentTemplates[docType].replace(
      /\[TITLE_PLACEHOLDER\]/g,
      title,
    )}\n\nIf you need to include tabular data, use the following format:
    TABLE: [Table Caption]
    HEADER: Column1 | Column2 | Column3
    ROW: Value1 | Value2 | Value3
    ROW: Value1 | Value2 | Value3
    ENDTABLE`;

    const { fullStream } = streamText({
      model: myProvider.languageModel(chatModels[0].id), // Use primary chat model
      instructions: templateWithTableSupport,
      prompt: `Write a professional ${docType} document about: ${title}. Include tables for any relevant data.`,
    });

    for await (const chunk of fullStream) {
      if (chunk.type === 'text-delta') {
        fullContent += (chunk as any).textDelta || (chunk as any).text || '';
      }
    }
  } catch (error) {
    console.error('Error generating PDF content:', error);
    // Return fallback content if there's an error
    return {
      title: title || 'Error Document',
      sections: [
        { type: 'heading', content: 'Error Generating Document' },
        {
          type: 'paragraph',
          content:
            'We are sorry, we could not generate content for this document. Please try again.',
        },
      ],
    };
  }

  // Process content even if it doesn't perfectly match expected format
  const lines = fullContent.split('\n').filter((line) => line.trim());
  let documentTitle = title;
  const sections: PDFSection[] = [];

  let inTable = false;
  let currentTable: PDFSection | null = null;

  // Extract sections and properly format them
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('TITLE:')) {
      documentTitle = line.replace('TITLE:', '').trim() || title;
    } else if (line.startsWith('TABLE:')) {
      // Start of table section
      inTable = true;
      const tableCaption = line.replace('TABLE:', '').trim();
      currentTable = {
        type: 'table',
        content: tableCaption,
        tableData: {
          headers: [],
          rows: [],
          caption: tableCaption,
          notes: '', // Initialize empty notes
        },
      };
    } else if (inTable && line.startsWith('HEADER:')) {
      // Table headers
      if (currentTable?.tableData) {
        const headerContent = line.replace('HEADER:', '').trim();
        currentTable.tableData.headers = headerContent
          .split('|')
          .map((h) => h.trim());
      }
    } else if (inTable && line.startsWith('ROW:')) {
      // Table row
      if (currentTable?.tableData) {
        const rowContent = line.replace('ROW:', '').trim();
        const rowCells = rowContent.split('|').map((cell) => cell.trim());
        currentTable.tableData.rows.push(rowCells);
      }
    } else if (inTable && line.startsWith('ENDTABLE')) {
      // End of table
      inTable = false;
      if (currentTable) {
        sections.push(currentTable);
        currentTable = null;
      }
    } else if (line.startsWith('INTRODUCTION:')) {
      sections.push({ type: 'heading', content: 'Introduction' });
      sections.push({
        type: 'paragraph',
        content: line.replace('INTRODUCTION:', '').trim(),
      });
    } else if (line.startsWith('SECTION:')) {
      sections.push({
        type: 'heading',
        content: line.replace('SECTION:', '').trim(),
      });
    } else if (line.startsWith('CONCLUSION:')) {
      sections.push({ type: 'heading', content: 'Conclusion' });
      sections.push({
        type: 'paragraph',
        content: line.replace('CONCLUSION:', '').trim(),
      });
    } else if (line.trim()) {
      // If we have unmatched content but previous item was a heading, treat as paragraph
      if (
        sections.length > 0 &&
        sections[sections.length - 1].type === 'heading'
      ) {
        sections.push({ type: 'paragraph', content: line.trim() });
      }
      // Otherwise add as paragraph if not a command line
      else if (!line.match(/^[A-Z]+:/)) {
        sections.push({ type: 'paragraph', content: line.trim() });
      }
    }
  }

  // If there's an unclosed table at the end, add it
  if (inTable && currentTable) {
    sections.push(currentTable);
  }

  // Ensure we have at least some content
  if (sections.length === 0) {
    sections.push(
      { type: 'heading', content: documentTitle },
      {
        type: 'paragraph',
        content: 'This document was automatically generated.',
      },
    );
  }

  return { title: documentTitle, sections };
}

// Schema validation
const pdfInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  docType: z
    .enum(['protocol', 'report', 'analysis', 'review', 'general'])
    .default('general'),
});

// Unified PDF generation function with APA formatting
async function generateAndStreamPdf(
  input: { title: string; docType?: BioinformaticsDocType },
): Promise<string> {
  try {
    // Validate input
    const { title, docType } = pdfInputSchema.parse(input);

    // Generate content
    const { title: docTitle, sections } = await generatePDFContent(
      title,
      docType,
    );

    // Create PDF with APA formatting
    const doc = new jsPDF();
    const renderer = new APADocumentRenderer(doc, docTitle);

    // Initialize document with APA header
    renderer.renderTitlePage();

    // Render content with APA formatting
    renderer.renderContent(sections);

    // Get PDF as base64
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    if (!pdfBase64 || pdfBase64.length < 100) {
      throw new Error('Invalid PDF output');
    }

    return pdfBase64;
  } catch (error) {
    return handlePdfError(error);
  }
}

// Error handler
const handlePdfError = (error: unknown): string => {
  console.error(`PDF generation failed: ${error}`);

  const errorDoc = new jsPDF();
  errorDoc
    .setFontSize(22)
    .setTextColor(255, 0, 0)
    .text('Error Generating PDF', 105, 20, { align: 'center' });
  errorDoc
    .setFontSize(12)
    .setTextColor(0)
    .text('An error occurred. Please try again.', 105, 40, { align: 'center' });

  const errorPdfBase64 = errorDoc.output('datauristring').split(',')[1];
  return errorPdfBase64;
};

export const pdfDocumentHandler = createDocumentHandler<'pdf'>({
  kind: 'pdf',
  onCreateDocument: async ({ title }) => {
    return generateAndStreamPdf({ title });
  },

  onUpdateDocument: async ({ description }) => {
    return generateAndStreamPdf({ title: description });
  },
});
