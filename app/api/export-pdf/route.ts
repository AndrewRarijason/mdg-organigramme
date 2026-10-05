import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { createExportEntry, deleteExportEntry } from '@/app/lib/exportCache';
import { composeOrgChartPdf } from '@/app/lib/pdfCompose';
import {
  getPrintPageSize,
  isPaperFormat,
  pickDeviceScaleFactor,
  planPdfLayout,
  type PaperFormat,
  type PdfLayoutMode,
} from '@/app/lib/pdfLayout';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Archive Chromium de secours, de la même version que @sparticuz/chromium
 * (package.json). Utilisée seulement si les binaires du paquet n'ont pas
 * été inclus dans la fonction serverless.
 */
const CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

/** Vercel (ou AWS Lambda) : Linux sans navigateur installé. */
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Emplacements habituels de Chrome / Edge / Brave / Chromium sur un poste de développement. */
function localBrowserCandidates(): string[] {
  if (process.platform === 'win32') {
    const roots = [
      process.env.PROGRAMFILES,
      process.env['PROGRAMFILES(X86)'],
      process.env.LOCALAPPDATA,
    ].filter((root): root is string => Boolean(root));
    const browsers = [
      ['Google', 'Chrome', 'Application', 'chrome.exe'],
      ['Microsoft', 'Edge', 'Application', 'msedge.exe'],
      ['BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'],
      ['Chromium', 'Application', 'chrome.exe'],
    ];
    return browsers.flatMap((parts) => roots.map((root) => path.join(root, ...parts)));
  }

  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }

  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
  ];
}

/**
 * Navigateur installé sur la machine (développement local). La variable
 * PUPPETEER_EXECUTABLE_PATH (ou CHROME_PATH) dans .env.local est prioritaire.
 */
function findLocalBrowser(): string {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (configured) {
    if (existsSync(configured)) return configured;
    throw new Error(`Navigateur introuvable à l'emplacement configuré (${configured}).`);
  }

  const found = localBrowserCandidates().find((candidate) => existsSync(candidate));
  if (found) return found;

  throw new Error(
    'Aucun navigateur Chrome, Edge ou Brave trouvé sur cette machine. Installez Google Chrome ' +
      'ou indiquez son chemin dans .env.local (PUPPETEER_EXECUTABLE_PATH=...).'
  );
}

/**
 * Lance le navigateur utilisé pour la capture :
 * - sur Vercel : le Chromium Linux fourni par @sparticuz/chromium ;
 * - en local : Chrome / Edge installé sur le poste.
 */
async function launchBrowser() {
  if (!isServerless) {
    return puppeteer.launch({
      executablePath: findLocalBrowser(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
  }

  let executablePath: string;
  try {
    // Binaires inclus dans la fonction (voir outputFileTracingIncludes dans next.config.ts)
    executablePath = await chromium.executablePath();
  } catch (err) {
    console.warn("Chromium embarqué indisponible, téléchargement de l'archive :", err);
    executablePath = await chromium.executablePath(CHROMIUM_PACK_URL);
  }

  return puppeteer.launch({
    args: await puppeteer.defaultArgs({ args: chromium.args, headless: 'shell' }),
    executablePath,
    headless: 'shell',
  });
}

export async function POST(req: NextRequest) {
  let browser: import('puppeteer-core').Browser | null = null;
  let exportId: string | null = null;

  try {
    // ---------------------------------------------------------
    // 1. Récupération des données
    // ---------------------------------------------------------

    const { nodes, edges, title, format, mode } = await req.json();

    // Format papier du PDF (A3 par défaut) et découpage éventuel en feuilles A4
    const paperFormat: PaperFormat = isPaperFormat(format) ? format : 'A3';
    const layoutMode: PdfLayoutMode = mode === 'tiled' ? 'tiled' : 'single';

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
    // 2. Lancement du navigateur (avant toute écriture en base :
    //    s'il est introuvable, on échoue tout de suite)
    // ---------------------------------------------------------

    browser = await launchBrowser();

    // ---------------------------------------------------------
    // 3. Création de l'entrée temporaire d'export
    // ---------------------------------------------------------

    exportId = await createExportEntry(
      nodes,
      edges,
      title || 'organigramme'
    );

    // ---------------------------------------------------------
    // 4. URL de la page à imprimer
    // ---------------------------------------------------------

    const origin = req.nextUrl.origin;

    const printUrl = `${origin}/print/${exportId}`;

    // ---------------------------------------------------------
    // 5. Création de la page
    // ---------------------------------------------------------

    const page = await browser.newPage();

    // Résolution de la capture adaptée au format papier visé : un A0
    // demande plus de pixels qu'un A4 pour rester net à l'impression.
    const expectedSize = getPrintPageSize(nodes, Array.isArray(edges) ? edges : []);
    const deviceScaleFactor = pickDeviceScaleFactor(
      expectedSize,
      planPdfLayout(expectedSize, paperFormat, layoutMode)
    );

    await page.setViewport({
      width: 2400,
      height: 1600,
      deviceScaleFactor,
    });

    // ---------------------------------------------------------
    // 6. Chargement de la page d'impression
    // ---------------------------------------------------------

    await page.goto(printUrl, {
      waitUntil: 'networkidle0',
    });

    // ---------------------------------------------------------
    // 7. Attendre que le diagramme soit prêt
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
    // 8. Récupération de la zone à capturer
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
    // 9. Calcul de la zone de capture
    // ---------------------------------------------------------

    const box = await target.boundingBox();

    if (!box) {
      throw new Error(
        'Impossible de mesurer le diagramme'
      );
    }

    // ---------------------------------------------------------
    // 10. Capture PNG
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
    // 11. Fermeture de Chromium
    // ---------------------------------------------------------

    await browser.close();

    browser = null;

    // ---------------------------------------------------------
    // 12. Création du PDF au format papier choisi
    // ---------------------------------------------------------

    const plan = planPdfLayout(
      { width: box.width, height: box.height },
      paperFormat,
      layoutMode
    );

    const pdfBytes = await composeOrgChartPdf(
      screenshot,
      plan,
      (title || 'Organigramme').toString()
    );

    // ---------------------------------------------------------
    // 13. Nom du fichier
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

    const filename = `${safeTitle}-${paperFormat}${layoutMode === 'tiled' ? '-feuilles-a4' : ''}.pdf`;

    // ---------------------------------------------------------
    // 14. Retour du PDF
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