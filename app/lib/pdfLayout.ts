import type { Edge, Node } from '@xyflow/react';

/**
 * Géométrie de l'export PDF, partagée entre :
 * - la page /print/[exportId] (taille de la zone capturée par Puppeteer),
 * - la route /api/export-pdf (choix de la résolution + mise en page),
 * - la fenêtre de choix du format (estimation de la taille du texte imprimé).
 *
 * Avant, la page du PDF faisait la taille de la capture en pixels
 * (souvent plus de 2 m de large) : à l'impression, le lecteur PDF
 * réduisait tout pour tenir sur une feuille A4 et le texte devenait
 * minuscule. Désormais la page du PDF a la taille réelle d'un format
 * papier (A4 → A0), éventuellement découpé en feuilles A4 à assembler.
 */

// --- Page /print : marges et bandeaux autour du diagramme (px CSS) ---
export const PRINT_MARGIN = 40;
export const PRINT_HEADER_HEIGHT = 56;
export const PRINT_LOGO_SECTION_HEIGHT = 56;

// Taille des polices des cartes (voir PersonneNode) — sert à estimer
// la taille du texte une fois imprimé.
export const NAME_FONT_PX = 16;
export const JOB_FONT_PX = 12;

export type PaperFormat = 'A4' | 'A3' | 'A2' | 'A1' | 'A0';
export type PdfLayoutMode = 'single' | 'tiled';
export type PdfExportOptions = { format: PaperFormat; mode: PdfLayoutMode };

export const PAPER_FORMATS: PaperFormat[] = ['A4', 'A3', 'A2', 'A1', 'A0'];

// Dimensions portrait en millimètres (ISO 216)
export const PAPER_MM: Record<PaperFormat, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
  A0: { width: 841, height: 1189 },
};

const MM_TO_PT = 72 / 25.4;
// Marge blanche autour de chaque feuille : hors de la zone non imprimable
// des imprimantes, et place pour les repères de découpe en mode assemblage.
const SHEET_MARGIN_MM = 10;

export function isPaperFormat(value: unknown): value is PaperFormat {
  return typeof value === 'string' && (PAPER_FORMATS as string[]).includes(value);
}

export type ExportNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  style: { width: number; height: number };
  data: { firstName: string; lastName: string; jobTitle: string; photoUrl: string };
};

/** Nœuds réduits au strict nécessaire pour la page d'impression. */
export function toExportNodes(nodes: Node[]): ExportNode[] {
  return nodes.map((n) => {
    const data = n.data as Partial<ExportNode['data']>;
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      style: {
        width: (typeof n.style?.width === 'number' ? n.style.width : undefined) || n.measured?.width || 200,
        height: (typeof n.style?.height === 'number' ? n.style.height : undefined) || n.measured?.height || 130,
      },
      data: {
        firstName: data?.firstName || '',
        lastName: data?.lastName || '',
        jobTitle: data?.jobTitle || '',
        photoUrl: data?.photoUrl || '',
      },
    };
  });
}

/** Boîte englobante du diagramme (cartes + couloirs de contournement), marges incluses. */
export function computeExportBounds(
  nodes: Pick<Node, 'position' | 'style'>[],
  edges: Pick<Edge, 'data'>[]
) {
  if (nodes.length === 0) return { minX: 0, minY: 0, width: 800, height: 600 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    const width = (typeof n.style?.width === 'number' ? n.style.width : undefined) || 200;
    const height = (typeof n.style?.height === 'number' ? n.style.height : undefined) || 130;
    minX = Math.min(minX, n.position.x);
    minY = Math.min(minY, n.position.y);
    maxX = Math.max(maxX, n.position.x + width);
    maxY = Math.max(maxY, n.position.y + height);
  });

  edges.forEach((e) => {
    const bypassX = e.data?.bypassX as number | undefined;
    if (typeof bypassX === 'number' && !isNaN(bypassX)) {
      minX = Math.min(minX, bypassX);
      maxX = Math.max(maxX, bypassX);
    }
  });

  return {
    minX,
    minY,
    width: Math.ceil(maxX - minX) + PRINT_MARGIN * 2,
    height: Math.ceil(maxY - minY) + PRINT_MARGIN * 2,
  };
}

/** Taille totale (px CSS) de la zone capturée : titre + logo + diagramme. */
export function getPrintPageSize(nodes: Pick<Node, 'position' | 'style'>[], edges: Pick<Edge, 'data'>[]) {
  const bounds = computeExportBounds(nodes, edges);
  return {
    width: bounds.width,
    height: bounds.height + PRINT_HEADER_HEIGHT + PRINT_LOGO_SECTION_HEIGHT,
  };
}

type Size = { width: number; height: number };

export type PdfPlan = {
  format: PaperFormat;
  mode: PdfLayoutMode;
  orientation: 'portrait' | 'landscape';
  /** Taille de chaque page du PDF (pt). */
  sheet: Size;
  /** Format de chaque page : le format choisi, ou A4 en mode assemblage. */
  sheetFormat: PaperFormat;
  marginPt: number;
  /** Zone imprimée de chaque page, marges déduites (pt). */
  cell: Size;
  /** Grille des feuilles réellement imprimées (1 × 1 hors assemblage). */
  cols: number;
  rows: number;
  /** Position de l'image dans la zone assemblée (origine en haut à gauche, pt). */
  image: { x: number; y: number; width: number; height: number };
  /** Facteur px CSS → pt. */
  ptPerPx: number;
  sheets: { row: number; col: number }[];
};

function paperPt(format: PaperFormat, orientation: 'portrait' | 'landscape'): Size {
  const { width, height } = PAPER_MM[format];
  return orientation === 'portrait'
    ? { width: width * MM_TO_PT, height: height * MM_TO_PT }
    : { width: height * MM_TO_PT, height: width * MM_TO_PT };
}

function planForOrientation(
  content: Size,
  format: PaperFormat,
  mode: PdfLayoutMode,
  orientation: 'portrait' | 'landscape'
): PdfPlan {
  const marginPt = SHEET_MARGIN_MM * MM_TO_PT;
  const poster = paperPt(format, orientation);

  let sheet = poster;
  let sheetFormat = format;
  let cols = 1;
  let rows = 1;

  if (mode === 'tiled') {
    // Un format A(n) se découpe exactement en feuilles A4 : A3 = 2, A2 = 4,
    // A1 = 8, A0 = 16. On choisit l'orientation des feuilles A4 qui pave
    // le poster sans reste.
    const best = (['portrait', 'landscape'] as const)
      .map((o) => {
        const tile = paperPt('A4', o);
        const c = Math.max(1, Math.round(poster.width / tile.width));
        const r = Math.max(1, Math.round(poster.height / tile.height));
        const error = Math.abs(c * tile.width - poster.width) + Math.abs(r * tile.height - poster.height);
        return { tile, c, r, error };
      })
      .sort((a, b) => a.error - b.error)[0];
    sheet = best.tile;
    sheetFormat = 'A4';
    cols = best.c;
    rows = best.r;
  }

  const cell = { width: sheet.width - 2 * marginPt, height: sheet.height - 2 * marginPt };
  const ptPerPx = Math.min((cols * cell.width) / content.width, (rows * cell.height) / content.height);
  const imageWidth = content.width * ptPerPx;
  const imageHeight = content.height * ptPerPx;

  // Assemblage : un organigramme très large n'occupe souvent qu'une partie
  // du poster. On n'imprime que les feuilles utiles, et l'image est centrée
  // dans ce bloc de feuilles plutôt que dans tout le poster.
  if (cols * rows > 1) {
    cols = Math.min(cols, Math.max(1, Math.ceil(imageWidth / cell.width - 0.01)));
    rows = Math.min(rows, Math.max(1, Math.ceil(imageHeight / cell.height - 0.01)));
  }
  const image = {
    x: (cols * cell.width - imageWidth) / 2,
    y: (rows * cell.height - imageHeight) / 2,
    width: imageWidth,
    height: imageHeight,
  };

  const sheets: { row: number; col: number }[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) sheets.push({ row, col });
  }

  return { format, mode, orientation, sheet, sheetFormat, marginPt, cell, cols, rows, image, ptPerPx, sheets };
}

/**
 * Mise en page du diagramme (`content`, en px CSS) sur le format choisi.
 * L'orientation (portrait / paysage) est celle qui donne le plus grand
 * agrandissement.
 */
export function planPdfLayout(content: Size, format: PaperFormat, mode: PdfLayoutMode): PdfPlan {
  const effectiveMode: PdfLayoutMode = format === 'A4' ? 'single' : mode;
  const landscape = planForOrientation(content, format, effectiveMode, 'landscape');
  const portrait = planForOrientation(content, format, effectiveMode, 'portrait');
  return portrait.ptPerPx > landscape.ptPerPx ? portrait : landscape;
}

/** Taille (pt) du nom des personnes une fois imprimé avec ce plan. */
export function printedNameSizePt(plan: PdfPlan) {
  return NAME_FONT_PX * plan.ptPerPx;
}

/** Dimensions (cm) de l'organigramme une fois imprimé / assemblé. */
export function printedSizeCm(plan: PdfPlan) {
  return {
    width: plan.image.width / MM_TO_PT / 10,
    height: plan.image.height / MM_TO_PT / 10,
  };
}

const TARGET_DPI = 220;
const MAX_CAPTURE_PIXELS = 36_000_000; // reste confortable en mémoire / durée sur Vercel
const MAX_CAPTURE_SIDE = 16_000; // limite de capture de Chromium

/**
 * Facteur de résolution de la capture Puppeteer : assez élevé pour une
 * impression nette (~220 dpi) même en A1/A0, sans dépasser les limites
 * de mémoire et de taille de capture.
 */
export function pickDeviceScaleFactor(content: Size, plan: PdfPlan) {
  const forDpi = (TARGET_DPI * plan.ptPerPx) / 72;
  let scale = Math.min(4, Math.max(2, forDpi));
  scale = Math.min(
    scale,
    Math.sqrt(MAX_CAPTURE_PIXELS / (content.width * content.height)),
    MAX_CAPTURE_SIDE / Math.max(content.width, content.height)
  );
  return Math.max(1, Math.floor(scale * 100) / 100);
}
