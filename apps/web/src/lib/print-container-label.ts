import type { PDFFont, PDFPage } from "pdf-lib";

type LabelInput = {
  name: string;
  description: string;
  location: string;
  owner?: string | null;
  labelId: string;
  qrCodeDataUri: string;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LABEL_WIDTH = 518.4;
const LABEL_HEIGHT = LABEL_WIDTH * 520 / 760;
const LABEL_X = (PAGE_WIDTH - LABEL_WIDTH) / 2;
const LABEL_TOP = 40;
function y(top: number, height = 0) { return PAGE_HEIGHT - top - height; }

function drawText(page: PDFPage, text: string, x: number, top: number, size: number, font: PDFFont) {
  page.drawText(text, { x, y: y(top, size), size, font });
}

function drawRight(page: PDFPage, text: string, right: number, top: number, size: number, font: PDFFont) {
  drawText(page, text, right - font.widthOfTextAtSize(text, size), top, size, font);
}

function fitSize(text: string, font: PDFFont, preferred: number, maxWidth: number, minimum = 15) {
  return Math.max(minimum, Math.min(preferred, preferred * maxWidth / Math.max(1, font.widthOfTextAtSize(text, preferred))));
}

function wrappedLines(text: string, font: PDFFont, size: number, maxWidth: number, limit: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else { lines.push(line); line = word; }
    if (lines.length === limit) break;
  }
  if (line && lines.length < limit) lines.push(line);
  return lines;
}

export async function printContainerLabel(input: LabelInput) {
  // Open synchronously so mobile Safari treats this as a user-initiated tab.
  // Printing a PDF through a hidden iframe makes iOS print the surrounding web
  // document instead, adding URL/date footers and applying viewport scaling.
  const preview = window.open("", "_blank");
  if (preview) {
    preview.document.title = "Preparing StuffHub label…";
    preview.document.body.textContent = "Preparing print-ready label…";
  }

  try {
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    pdf.setTitle(`${input.name} — StuffHub container label`);
    pdf.setCreator("StuffHub");
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const sans = await pdf.embedFont(StandardFonts.Helvetica);
    const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const qr = await pdf.embedPng(input.qrCodeDataUri);
    const left = LABEL_X;
    const right = LABEL_X + LABEL_WIDTH;
    const top = LABEL_TOP;

    page.drawRectangle({
      x: left,
      y: y(top, LABEL_HEIGHT),
      width: LABEL_WIDTH,
      height: LABEL_HEIGHT,
      color: rgb(1, 1, 1),
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.5,
    });

    const markX = left + 28;
    const markTop = top + 24;
    page.drawRectangle({ x: markX, y: y(markTop, 34), width: 34, height: 34 });
    const markWidth = sansBold.widthOfTextAtSize("S", 19);
    page.drawText("S", { x: markX + (34 - markWidth) / 2, y: y(markTop + 5, 19), size: 19, font: sansBold, color: rgb(1, 1, 1) });
    drawText(page, "STUFFHUB", markX + 44, markTop + 4, 14, sansBold);
    drawText(page, "HOME INVENTORY", markX + 44, markTop + 21, 6.5, sansBold);
    drawRight(page, "CONTAINER LABEL", right - 28, markTop + 8, 6.5, sansBold);

    const headerRuleTop = top + 73;
    page.drawLine({ start: { x: left + 28, y: y(headerRuleTop) }, end: { x: right - 28, y: y(headerRuleTop) }, thickness: 1.5 });

    const qrSize = 154;
    const qrX = left + 38;
    const qrTop = top + 105;
    page.drawImage(qr, { x: qrX, y: y(qrTop, qrSize), width: qrSize, height: qrSize });
    const scan = "SCAN TO OPEN";
    drawText(page, scan, qrX + (qrSize - sansBold.widthOfTextAtSize(scan, 8.5)) / 2, qrTop + 164, 8.5, sansBold);
    const scanNote = "Point the StuffHub scanner at this code";
    drawText(page, scanNote, qrX + (qrSize - sans.widthOfTextAtSize(scanNote, 5.7)) / 2, qrTop + 177, 5.7, sans);

    const detailsX = left + 221;
    const detailsWidth = right - 28 - detailsX;
    drawText(page, "CONTAINER", detailsX, top + 111, 6.5, sansBold);
    const titleSize = fitSize(input.name, serifBold, 26, detailsWidth, 15);
    drawText(page, input.name, detailsX, top + 124, titleSize, serifBold);
    const descriptionLines = wrappedLines(input.description || "Organized household storage", sans, 7.5, detailsWidth, 2);
    descriptionLines.forEach((line, index) => drawText(page, line, detailsX, top + 157 + index * 10, 7.5, sans));

    const rowTop = top + 190;
    const rows = [["LOCATION", input.location], ...(input.owner ? [["OWNER", input.owner]] : []), ["LABEL ID", input.labelId]];
    rows.forEach(([label, value], index) => {
      const lineTop = rowTop + index * 22;
      page.drawLine({ start: { x: detailsX, y: y(lineTop) }, end: { x: right - 28, y: y(lineTop) }, thickness: .65 });
      drawText(page, label!, detailsX, lineTop + 7, 5.8, sansBold);
      drawText(page, value!, detailsX + 70, lineTop + 6, 7, sansBold);
    });
    const rowsBottom = rowTop + rows.length * 22;
    page.drawLine({ start: { x: detailsX, y: y(rowsBottom) }, end: { x: right - 28, y: y(rowsBottom) }, thickness: .65 });

    const footerTop = top + 300;
    page.drawLine({ start: { x: left + 28, y: y(footerTop) }, end: { x: right - 28, y: y(footerTop) }, thickness: .75 });
    drawText(page, "PRIVATE HOME INVENTORY", left + 62, footerTop + 14, 5.6, sansBold);
    const footerNote = "Keep this label attached to its assigned container.";
    drawText(page, footerNote, left + (LABEL_WIDTH - sans.widthOfTextAtSize(footerNote, 5.7)) / 2, footerTop + 14, 5.7, sans);
    drawRight(page, input.labelId, right - 62, footerTop + 14, 5.6, sansBold);

    const bytes = await pdf.save();
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
    if (preview) preview.location.replace(url);
    else window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
  } catch (error) {
    preview?.close();
    throw error;
  }
}
