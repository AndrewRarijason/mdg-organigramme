import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { PDFDocument } from 'pdf-lib';
import { createExportEntry, deleteExportEntry } from '@/app/lib/exportCache';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SCALE = 2;

/**
 * Retourne le chemin vers Chrome installé localement.
 *
 * Sur Vercel, cette fonction n'est jamais utilisée :
 * @sparticuz/chromium fournit son propre Chromium.
 */
function getLocalExecutablePath(): string {
  // Variable d'environnement prioritaire
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // Windows
  if (process.platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  // macOS
  if (process.platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  // Linux
  return '/usr/bin/google-chrome';
}

export async function POST(req: NextRequest) {
  let browser: import('puppeteer-core').Browser | null = null;
  let exportId: string | null = null;

  try {
    // ---------------------------------------------------------
    // 1. Récupération des données
    // ---------------------------------------------------------

    const { nodes, edges, title } = await req.json();

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        {
          error: 'Aucun nœud à exporter',
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 2. Création de l'entrée temporaire d'export
    // ---------------------------------------------------------

    exportId = await createExportEntry(
      nodes,
      edges,
      title || 'organigramme'
    );

    // ---------------------------------------------------------
    // 3. URL de la page à imprimer
    // ---------------------------------------------------------

    const origin = req.nextUrl.origin;

    const printUrl = `${origin}/print/${exportId}`;

    // ---------------------------------------------------------
    // 4. Détection de Vercel
    // ---------------------------------------------------------

    const isVercel = Boolean(process.env.VERCEL);

    // ---------------------------------------------------------
    // 5. Configuration de Chromium
    // ---------------------------------------------------------

    let executablePath: string;

    if (isVercel) {
      /**
       * Sur Vercel :
       *
       * On utilise Chromium fourni par @sparticuz/chromium.
       *
       * Aucun accès fs / existsSync n'est nécessaire.
       */
      executablePath = await chromium.executablePath(
        'https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar'
      );
    } else {
      /**
       * En développement local :
       * on utilise Chrome installé sur la machine.
       */
      executablePath = getLocalExecutablePath();
    }

    // ---------------------------------------------------------
    // 6. Lancement de Puppeteer
    // ---------------------------------------------------------

    browser = await puppeteer.launch({
      args: isVercel
        ? chromium.args
        : [
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],

      executablePath,

      headless: true,
    });

    // ---------------------------------------------------------
    // 7. Création de la page
    // ---------------------------------------------------------

    const page = await browser.newPage();

    await page.setViewport({
      width: 2400,
      height: 1600,
      deviceScaleFactor: SCALE,
    });

    // ---------------------------------------------------------
    // 8. Chargement de la page d'impression
    // ---------------------------------------------------------

    await page.goto(printUrl, {
      waitUntil: 'networkidle0',
    });

    // ---------------------------------------------------------
    // 9. Attendre que le diagramme soit prêt
    // ---------------------------------------------------------

    await page.waitForSelector(
      '[data-export-ready="true"]',
      {
        timeout: 15000,
      }
    );

    // Petit délai pour laisser le rendu graphique se stabiliser
    await new Promise((resolve) =>
      setTimeout(resolve, 150)
    );

    // ---------------------------------------------------------
    // 10. Récupération de la zone à capturer
    // ---------------------------------------------------------

    const target = await page.$(
      '[data-export-ready="true"]'
    );

    if (!target) {
      throw new Error(
        'Zone de capture introuvable'
      );
    }

    // ---------------------------------------------------------
    // 11. Calcul de la zone de capture
    // ---------------------------------------------------------

    const box = await target.boundingBox();

    if (!box) {
      throw new Error(
        'Impossible de mesurer le diagramme'
      );
    }

    // ---------------------------------------------------------
    // 12. Capture PNG
    // ---------------------------------------------------------

    const screenshot = await page.screenshot({
      type: 'png',

      clip: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    });

    // ---------------------------------------------------------
    // 13. Fermeture de Chromium
    // ---------------------------------------------------------

    await browser.close();

    browser = null;

    // ---------------------------------------------------------
    // 14. Création du PDF
    // ---------------------------------------------------------

    const pdfDoc = await PDFDocument.create();

    const png = await pdfDoc.embedPng(
      screenshot
    );

    const pdfPage = pdfDoc.addPage([
      png.width,
      png.height,
    ]);

    pdfPage.drawImage(png, {
      x: 0,
      y: 0,
      width: png.width,
      height: png.height,
    });

    const pdfBytes = await pdfDoc.save();

    // ---------------------------------------------------------
    // 15. Nom du fichier
    // ---------------------------------------------------------

    const safeTitle =
      (title || 'organigramme')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') ||
      'organigramme';

    const filename = `${safeTitle}.pdf`;

    // ---------------------------------------------------------
    // 16. Retour du PDF
    // ---------------------------------------------------------

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,

        headers: {
          'Content-Type': 'application/pdf',

          'Content-Disposition': `attachment; filename="${filename}"`,

          'Content-Length': pdfBytes.length.toString(),

          'Cache-Control':
            'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: unknown) {
    // ---------------------------------------------------------
    // Gestion des erreurs
    // ---------------------------------------------------------

    if (browser) {
      try {
        await browser.close();
      } catch {
        // Ignore les erreurs de fermeture
      }

      browser = null;
    }

    console.error(
      'Erreur export PDF Puppeteer :',
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : 'Erreur inconnue';

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  } finally {
    // ---------------------------------------------------------
    // Suppression de l'entrée temporaire
    // ---------------------------------------------------------

    if (exportId) {
      try {
        await deleteExportEntry(exportId);
      } catch (cleanupError) {
        console.error(
          'Erreur lors du nettoyage de exportId :',
          cleanupError
        );
      }
    }
  }
}