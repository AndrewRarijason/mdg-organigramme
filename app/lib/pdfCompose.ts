import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib';
import type { PdfPlan } from '@/app/lib/pdfLayout';

const MM = 72 / 25.4;
const MARK_COLOR = rgb(0.55, 0.6, 0.66);

/** Repères de découpe dans la marge, aux quatre coins de la zone imprimée. */
function drawCropMarks(page: PDFPage, plan: PdfPlan) {
  const { marginPt: m, cell, sheet } = plan;
  const gap = 1.5 * MM;
  const length = 6 * MM;
  const corners = [
    { x: m, y: sheet.height - m, dx: -1, dy: 1 }, // haut gauche
    { x: m + cell.width, y: sheet.height - m, dx: 1, dy: 1 }, // haut droite
    { x: m, y: m, dx: -1, dy: -1 }, // bas gauche
    { x: m + cell.width, y: m, dx: 1, dy: -1 }, // bas droite
  ];
  corners.forEach(({ x, y, dx, dy }) => {
    page.drawLine({
      start: { x: x + dx * gap, y },
      end: { x: x + dx * (gap + length), y },
      thickness: 0.5,
      color: MARK_COLOR,
    });
    page.drawLine({
      start: { x, y: y + dy * gap },
      end: { x, y: y + dy * (gap + length) },
      thickness: 0.5,
      color: MARK_COLOR,
    });
  });
}

/**
 * Construit le PDF final à partir de la capture PNG du diagramme :
 * - mode "single" : une page au format choisi (A4 → A0), image centrée ;
 * - mode "tiled"  : le même poster découpé en feuilles A4 numérotées,
 *   avec repères de découpe, à assembler après impression.
 */
export async function composeOrgChartPdf(png: Uint8Array, plan: PdfPlan, title: string) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(title);
  pdfDoc.setCreator('MDG Services - Organigramme');

  const image = await pdfDoc.embedPng(png);
  const tiled = plan.cols * plan.rows > 1;
  const font = tiled ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null;
  const { sheet, marginPt: m, cell, image: img } = plan;

  plan.sheets.forEach(({ row, col }, index) => {
    const page = pdfDoc.addPage([sheet.width, sheet.height]);

    // Position de l'image vue depuis cette feuille (pdf-lib : origine en bas à gauche)
    const left = m + img.x - col * cell.width;
    const top = m + img.y - row * cell.height;
    const drawOptions = { x: left, y: sheet.height - top - img.height, width: img.width, height: img.height };

    if (!tiled) {
      page.drawImage(image, drawOptions);
      return;
    }

    // Seule la partie de l'image qui revient à cette feuille est imprimée
    page.pushOperators(pushGraphicsState(), rectangle(m, m, cell.width, cell.height), clip(), endPath());
    page.drawImage(image, drawOptions);
    page.pushOperators(popGraphicsState());

    drawCropMarks(page, plan);

    const label =
      `Feuille ${index + 1}/${plan.sheets.length} — ligne ${row + 1}, colonne ${col + 1}` +
      ' · Découpez le long des repères puis assemblez les feuilles';
    const fontSize = 7;
    const labelWidth = font!.widthOfTextAtSize(label, fontSize);
    page.drawText(label, {
      x: (sheet.width - labelWidth) / 2,
      y: m / 2 - fontSize / 2,
      size: fontSize,
      font: font!,
      color: MARK_COLOR,
    });
  });

  return pdfDoc.save();
}
