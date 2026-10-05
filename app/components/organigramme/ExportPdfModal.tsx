'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileDown, Printer, LayoutGrid, Check } from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import {
  PAPER_FORMATS,
  PAPER_MM,
  getPrintPageSize,
  planPdfLayout,
  printedNameSizePt,
  printedSizeCm,
  toExportNodes,
  type PaperFormat,
  type PdfExportOptions,
  type PdfLayoutMode,
} from '@/app/lib/pdfLayout';

const COMFORTABLE_PT = 9;
const READABLE_PT = 6.5;

function legibility(pt: number) {
  if (pt >= COMFORTABLE_PT) return { label: 'Confortable', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (pt >= READABLE_PT) return { label: 'Lisible de près', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Trop petit', className: 'bg-red-50 text-red-700 border-red-200' };
}

function formatPt(pt: number) {
  return pt.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

function orientationLabel(width: number, height: number) {
  return width > height ? 'paysage' : 'portrait';
}

function formatCm(value: number) {
  return Math.round(value).toLocaleString('fr-FR');
}

/**
 * Choix du format papier avant l'export PDF. Affiche, pour chaque format,
 * la taille estimée du texte une fois imprimé, et propose de découper les
 * grands formats en feuilles A4 à assembler (pour une imprimante de bureau).
 */
export function ExportPdfModal({
  open,
  onClose,
  nodes,
  edges,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  onExport: (options: PdfExportOptions) => void;
}) {
  // null = format recommandé (calculé selon la taille de l'organigramme)
  const [format, setFormat] = useState<PaperFormat | null>(null);
  const [mode, setMode] = useState<PdfLayoutMode>('single');

  const contentSize = useMemo(
    () => (open && nodes.length > 0 ? getPrintPageSize(toExportNodes(nodes), edges) : null),
    [open, nodes, edges]
  );

  // En mode assemblage, A4 n'a pas de sens (ce serait une seule feuille A4)
  const options = useMemo(() => {
    if (!contentSize) return [];
    return PAPER_FORMATS.filter((f) => mode === 'single' || f !== 'A4').map((f) => {
      const plan = planPdfLayout(contentSize, f, mode);
      return { format: f, plan, namePt: printedNameSizePt(plan) };
    });
  }, [contentSize, mode]);

  const recommended: PaperFormat =
    options.find((o) => o.namePt >= COMFORTABLE_PT)?.format ?? 'A0';
  const selectedFormat = format && options.some((o) => o.format === format) ? format : recommended;
  const selectedPlan = options.find((o) => o.format === selectedFormat)?.plan ?? null;

  const handleClose = () => {
    setFormat(null);
    setMode('single');
    onClose();
  };

  const handleExport = () => {
    onExport({ format: selectedFormat, mode });
    handleClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80"
            initial={{ scale: 0.95, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative p-4 sm:p-6 bg-gradient-to-br from-[#205170] to-[#123746] text-white overflow-hidden flex items-center justify-between shadow-md shrink-0">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 flex items-center gap-3.5">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner">
                  <FileDown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-[17px] md:text-[18px] font-bold text-white">Exporter en PDF</h2>
                  <div className="flex text-[10px] md:text-[11px] items-center gap-1.5 text-indigo-200 font-semibold tracking-wide uppercase mb-0.5">
                    Format d&apos;impression
                  </div>
                </div>
              </div>

              <motion.button
                onClick={handleClose}
                aria-label="Fermer"
                className="relative z-10 p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5">
              {!contentSize ? (
                <div className="py-10 text-center text-[13px] md:text-sm text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  L&apos;organigramme est vide : ajoutez au moins un employé avant d&apos;exporter.
                </div>
              ) : (
                <>
                  {/* Mode d'impression */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-800 mb-2">Impression</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('single')}
                        aria-pressed={mode === 'single'}
                        className={`rounded-xl px-3 py-2.5 text-[12px] sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          mode === 'single'
                            ? 'bg-[#205170] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Printer className="w-4 h-4 shrink-0" />
                        Une seule feuille
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('tiled')}
                        aria-pressed={mode === 'tiled'}
                        className={`rounded-xl px-3 py-2.5 text-[12px] sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          mode === 'tiled'
                            ? 'bg-[#205170] text-white shadow-sm'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LayoutGrid className="w-4 h-4 shrink-0" />
                        Feuilles A4 à assembler
                      </button>
                    </div>
                  </section>

                  {/* Format du papier */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-800 mb-2">
                      {mode === 'single' ? 'Format du papier' : "Taille finale de l'organigramme"}
                    </h3>
                    <div className="flex flex-col gap-2" role="radiogroup" aria-label="Format du papier">
                      {options.map(({ format: f, plan, namePt }) => {
                        const active = f === selectedFormat;
                        const level = legibility(namePt);
                        const mm = PAPER_MM[f];
                        const cm = printedSizeCm(plan);
                        return (
                          <button
                            key={f}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setFormat(f)}
                            className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 sm:px-3.5 text-left transition-all cursor-pointer ${
                              active
                                ? 'border-[#205170] bg-[#205170]/5 ring-2 ring-[#205170]/15'
                                : 'border-slate-200 hover:border-[#205170]/40 hover:bg-slate-50'
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                active ? 'border-[#205170] bg-[#205170]' : 'border-slate-300'
                              }`}
                            >
                              {active && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span className="font-bold text-slate-800 text-sm">{f}</span>
                                <span className="text-[11px] text-slate-400">
                                  {mode === 'single'
                                    ? `${Math.max(mm.width, mm.height)} × ${Math.min(mm.width, mm.height)} mm · ${orientationLabel(plan.sheet.width, plan.sheet.height)}`
                                    : `${plan.sheets.length} feuilles A4 · ${formatCm(cm.width)} × ${formatCm(cm.height)} cm`}
                                </span>
                                {f === recommended && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#205170] text-white rounded-full uppercase tracking-wide">
                                    Recommandé
                                  </span>
                                )}
                              </span>
                              <span className="block text-[11px] text-slate-500 mt-0.5">
                                Texte des noms ≈ {formatPt(namePt)} pt
                              </span>
                            </span>
                            <span
                              className={`shrink-0 text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border ${level.className}`}
                            >
                              {level.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {selectedPlan && (
                      <p className="mt-2.5 text-[11px] sm:text-xs leading-relaxed text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3">
                        {mode === 'single' ? (
                          <>
                            PDF d&apos;une page {selectedFormat}{' '}
                            {orientationLabel(selectedPlan.sheet.width, selectedPlan.sheet.height)}.
                            {selectedFormat === 'A4' || selectedFormat === 'A3'
                              ? ` À l'impression, choisissez le papier ${selectedFormat} et l'option « Taille réelle ».`
                              : " Ce format s'imprime chez un reprographe ou sur un traceur."}
                          </>
                        ) : (
                          <>
                            PDF de {selectedPlan.sheets.length} feuilles A4{' '}
                            {orientationLabel(selectedPlan.sheet.width, selectedPlan.sheet.height)} à imprimer sur une
                            imprimante de bureau, à découper le long des repères puis à assembler (
                            {formatCm(printedSizeCm(selectedPlan).width)} × {formatCm(printedSizeCm(selectedPlan).height)}{' '}
                            cm une fois assemblé).
                          </>
                        )}
                      </p>
                    )}
                  </section>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 p-4 sm:px-6 sm:pb-6 sm:pt-0 flex gap-2 sm:justify-end border-t border-slate-100 sm:border-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 sm:flex-none px-4 py-2.5 text-[13px] md:text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                onClick={handleExport}
                disabled={!contentSize}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-gradient-to-br from-[#205170] to-[#123746] text-white rounded-xl text-[13px] md:text-sm font-semibold shadow-md disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                <FileDown className="w-4 h-4" />
                Exporter le PDF
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
