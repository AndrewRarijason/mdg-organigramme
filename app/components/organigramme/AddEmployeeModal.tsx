'use client';

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Upload, Loader2, Crop, Sparkles } from 'lucide-react';
import type { Edge, Node } from '@xyflow/react';
import { getHierarchyLevels } from '@/app/lib/hierarchy';
import { ImageCropperModal } from './ImageCropperModal';
import { SupervisorSelect } from './SupervisorSelect';

export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoFile: File | null;
  parentIds: string[];
  hierarchyLevel: number | null;
  layoutSide?: 'left' | 'right' | null;
  routingMode?: 'independent' | 'shared';
}

export function AddEmployeeModal({
  open,
  onClose,
  existingNodes,
  existingEdges,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  existingNodes: Node[];
  existingEdges: Edge[];
  onSubmit: (data: EmployeeFormData) => Promise<void> | void;
  submitting?: boolean;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [hierarchyLevel, setHierarchyLevel] = useState('');
  const [layoutSide, setLayoutSide] = useState<'left' | 'right' | null>(null);
  const [routingMode, setRoutingMode] = useState<'independent' | 'shared' | null>(null);

  // États pour le recadrage
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setJobTitle('');
    setPhotoFile(null);
    setPhotoPreview(null);
    setParentIds([]);
    setRawImageSrc(null);
    setCropperOpen(false);
    setHierarchyLevel('');
    setLayoutSide(null);
    setRoutingMode(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setRawImageSrc(reader.result as string);
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    setPhotoFile(croppedFile);
    setPhotoPreview(URL.createObjectURL(croppedBlob));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    const parsedLevel = hierarchyLevel.trim() === '' ? null : Number(hierarchyLevel);

    const hasLevelJump = parsedLevel !== null && parentIds.some(
      (id) => parsedLevel > (getHierarchyLevels(existingNodes, existingEdges).get(id) || 1) + 1
    );
    if (hasLevelJump && (!layoutSide || !routingMode)) return;

    await onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      jobTitle: jobTitle.trim(),
      photoFile,
      parentIds,
      hierarchyLevel: parsedLevel && parsedLevel >= 1 ? parsedLevel : null, // ← AJOUTÉ
      layoutSide: hasLevelJump ? layoutSide : null,
      routingMode: hasLevelJump ? routingMode : 'independent',
    });

    resetForm();
  };

  const selectedParentLevels = useMemo(() => getHierarchyLevels(existingNodes, existingEdges), [existingNodes, existingEdges]);
  const requestedLevel = hierarchyLevel.trim() === '' ? null : Number(hierarchyLevel);
  const needsSideChoice = requestedLevel !== null && requestedLevel >= 1 && parentIds.some(
    (id) => requestedLevel > (selectedParentLevels.get(id) || 1) + 1
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          >
            <motion.div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-slate-200/80"
              initial={{ scale: 0.9, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 30, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Moderne & Stylisé */}
              <div className="relative p-6 bg-gradient-to-br from-[#205170] to-[#123746] text-white overflow-hidden flex items-center justify-between shadow-md">
                {/* Effets lumineux d'arrière-plan */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3.5">
                  <motion.div
                    className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-inner"
                    whileHover={{ scale: 1.08, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <UserPlus className="w-5 h-5 text-white" />
                  </motion.div>

                  <div>
                    <h2 className="text-[17px] tracking-[0.05em] md:tracking-normal md:text-[18px] font-bold text-white">
                      Ajouter un employé
                    </h2>
                    <div className="flex text-[9px] md:text-[10px] items-center gap-1.5 text-indigo-200 font-semibold tracking-wide uppercase mb-0.5">
                      Nouveau membre
                    </div>
                  </div>
                </div>

                <motion.button
                  onClick={handleClose}
                  className="relative z-10 p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 backdrop-blur-sm transition-all cursor-pointer"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Formulaire */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {/* Photo avec option de re-recadrage */}
                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="relative group">
                    <label className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white border-2 border-dashed border-indigo-200 flex-shrink-0 cursor-pointer flex items-center justify-center hover:border-indigo-500 transition-all shadow-sm group">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition-transform" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </label>

                    {photoPreview && (
                      <motion.button
                        type="button"
                        onClick={() => setCropperOpen(true)}
                        title="Ajuster le recadrage"
                        className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-500 transition cursor-pointer border border-white"
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    <p className="font-semibold text-slate-800 text-[13px] md:text-sm">Photo de profil</p>
                    <p className="mt-0.5">
                      {photoPreview ? 'Cliquez pour modifier le cadrage' : 'Cliquez pour ajouter et ajuster'}
                    </p>
                  </div>
                </div>

                {/* Prénom / Nom */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-800 mb-1 block">Prénom *</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-[13px] md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                      placeholder="Natacha"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-800 mb-1 block">Nom *</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-[13px] md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                      placeholder="RARIJASON"
                    />
                  </div>
                </div>

                {/* Poste */}
                <div>
                  <label className="text-xs font-semibold text-slate-800 mb-1 block">Intitulé du poste</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-[13px] md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                    placeholder="Responsable Marketing"
                  />
                </div>

                {/* Niveau hiérarchique (optionnel) */}
                <div>
                  <label className="text-xs font-semibold text-slate-800 mb-1 block">
                    Niveau hiérarchique <span className="font-normal text-slate-400">(optionnel)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={hierarchyLevel}
                    onChange={(e) => setHierarchyLevel(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-[13px] md:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all bg-slate-50/50 focus:bg-white"
                    placeholder="Laisser vide pour un placement automatique"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    1 = sommet de l'organigramme. Si vide, la personne se place juste sous son supérieur.
                  </p>
                </div>

                {/* Supérieur hiérarchique */}
                <div>
                  <label className="text-xs font-semibold text-slate-800 mb-1 block">
                    Supérieur(s) hiérarchique(s)
                  </label>
                  <SupervisorSelect
                    options={existingNodes.map((n) => {
                      const data = n.data as any;
                      return { id: n.id, firstName: data.firstName || '', lastName: data.lastName || '' };
                    })}
                    selectedIds={parentIds}
                    onChange={setParentIds}
                    emptyMessage="Aucun employé disponible pour le moment"
                  />
                </div>

                {needsSideChoice && (
                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-amber-900">Saut de niveau détecté : définissez le routage du lien.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([['independent', 'Indépendant'], ['shared', 'Partagé']] as const).map(([mode, label]) => (
                        <button key={mode} type="button" onClick={() => setRoutingMode(mode)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${routingMode === mode ? 'bg-[#205170] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{label}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['left', 'right'] as const).map((side) => (
                        <button key={side} type="button" onClick={() => setLayoutSide(side)} className={`rounded-xl px-3 py-2 text-sm font-semibold ${layoutSide === side ? 'bg-[#205170] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{side === 'left' ? 'Gauche' : 'Droite'}</button>
                      ))}
                    </div>
                  </section>
                )}

                <motion.button
                  type="submit"
                  disabled={submitting || !firstName.trim() || !lastName.trim()}
                  className="mt-2 w-full py-3.5 bg-gradient-to-br from-[#205170] to-[#123746] text-white rounded-xl tracking-[0.05em] md:tracking-normal text-[13px] md:text-sm font-semibold hover:from-[#2b6e99] hover:to-[#1d5770] transition-all duration-300 hover:scale-105 shadow-md hover:shadow-indigo-500/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Ajout en cours...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4.5 h-4.5" />
                      Ajouter à l'organigramme
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ImageCropperModal
        imageSrc={rawImageSrc}
        open={cropperOpen}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </>
  );
}
