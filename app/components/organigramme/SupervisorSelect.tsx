'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check, Users } from 'lucide-react';

export interface SupervisorOption {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * Sélecteur multiple de supérieurs hiérarchiques.
 *
 * Remplace le `<select multiple>` natif :
 * - la sélection au Ctrl/Cmd+clic n'est pas découvrable et est pénible
 *   sur mobile ;
 * - le nom + poste sur une seule ligne débordait et était tronqué de
 *   façon illisible.
 *
 * Nouveau design :
 * - un champ qui affiche les personnes déjà choisies sous forme de
 *   jetons (avatar-initiales + nom, retirables d'un clic) ;
 * - un panneau déroulant avec recherche live et une liste à cocher,
 *   une ligne = une personne, nom complet uniquement (sans le poste,
 *   qui causait la troncature).
 */
export function SupervisorSelect({
  options,
  selectedIds,
  onChange,
  placeholder = 'Sélectionner un ou plusieurs supérieurs',
  emptyMessage = 'Aucune personne disponible',
}: {
  options: SupervisorOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const getLabel = (o: SupervisorOption) =>
    `${o.lastName || ''} ${o.firstName || ''}`.trim() || 'Sans nom';
  const getInitials = (o: SupervisorOption) =>
    `${(o.firstName || '').trim().charAt(0)}${(o.lastName || '').trim().charAt(0)}`.toUpperCase() || '?';

  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((o) => o.id === id)).filter((o): o is SupervisorOption => !!o),
    [selectedIds, options]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => getLabel(o).toLowerCase().includes(q));
  }, [options, query]);

  // Fermeture au clic extérieur / touche Échap
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  // Focus automatique de la recherche à l'ouverture
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open]);

  const toggleOption = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const removeOption = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Champ (fermé) — jetons des personnes déjà sélectionnées */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full min-h-[42px] px-3 py-2 border rounded-xl text-left flex items-center justify-between gap-2 transition-all bg-slate-50/50 hover:bg-white cursor-pointer ${
          open ? 'border-[#205170] ring-2 ring-[#205170]/10 bg-white' : 'border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selectedOptions.length === 0 ? (
            <span className="text-[13px] md:text-sm text-slate-400">{placeholder}</span>
          ) : (
            selectedOptions.map((o) => (
              <span
                key={o.id}
                className="inline-flex items-center gap-1 bg-[#EDF3F6] text-[#205170] text-[11px] md:text-xs font-medium pl-1.5 pr-1 py-1 rounded-lg border border-[#205170]/10"
              >
                <span className="w-4 h-4 rounded-full bg-[#205170] text-white text-[8px] font-bold flex items-center justify-center flex-shrink-0">
                  {getInitials(o)}
                </span>
                <span className="max-w-[110px] truncate" title={getLabel(o)}>
                  {getLabel(o)}
                </span>
                <span
                  role="button"
                  aria-label={`Retirer ${getLabel(o)}`}
                  tabIndex={-1}
                  onClick={(e) => removeOption(o.id, e)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-[#205170]/15 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Panneau déroulant — recherche + liste à cocher */}
      {open && (
        <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-900/10 overflow-hidden">
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un nom..."
              className="w-full text-[13px] md:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none bg-transparent"
            />
          </div>

          <div className="max-h-48 overflow-y-auto py-1" role="listbox" aria-multiselectable="true">
            {filteredOptions.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6 text-slate-400">
                <Users className="w-5 h-5" />
                <p className="text-[12px] md:text-xs">{options.length === 0 ? emptyMessage : 'Aucun résultat'}</p>
              </div>
            ) : (
              filteredOptions.map((o) => {
                const isSelected = selectedIds.includes(o.id);
                return (
                  <div
                    key={o.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(o.id)}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EDF3F6]' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#205170] to-[#2d6d94] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {getInitials(o)}
                    </span>
                    <span
                      className="flex-1 min-w-0 truncate text-[13px] md:text-sm text-slate-700"
                      title={getLabel(o)}
                    >
                      {getLabel(o)}
                    </span>
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-[#205170] border-[#205170]' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}