import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { createExportEntry, deleteExportEntry } from '@/app/lib/exportCache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SCALE = 2;

export async function POST(req: NextRequest) {
  let browser: import('puppeteer').Browser | null = null;
  let exportId: string | null = null;

  try {
    const { nodes, edges, title } = await req.json();

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json({ error: 'Aucun nœud à exporter' }, { status: 400 });
    }

    exportId = createExportEntry(nodes, edges, title || 'organigramme');

    const origin = req.nextUrl.origin;
    const printUrl = `${origin}/print/${exportId}`;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 2400, height: 1600, deviceScaleFactor: SCALE });
    await page.goto(printUrl, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-export-ready="true"]', { timeout: 15000 });
    await new Promise((res) => setTimeout(res, 150));

    const target = await page.$('[data-export-ready="true"]');
    if (!target) throw new Error('Zone de capture introuvable');

    const box = await target.boundingBox();
    if (!box) throw new Error('Impossible de mesurer le diagramme');

    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    });

    await browser.close();
    browser = null;

    const pdfDoc = await PDFDocument.create();
    const png = await pdfDoc.embedPng(screenshot);
    const pdfPage = pdfDoc.addPage([png.width, png.height]);
    pdfPage.drawImage(png, { x: 0, y: 0, width: png.width, height: png.height });
    const pdfBytes = await pdfDoc.save();

    const filename = (title || 'organigramme').toLowerCase().replace(/\s+/g, '-') + '.pdf';

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    if (browser) await browser.close();
    console.error('Erreur export PDF Puppeteer :', err);
    return NextResponse.json({ error: err?.message || 'Erreur inconnue' }, { status: 500 });
  } finally {
    if (exportId) deleteExportEntry(exportId);
  }
}