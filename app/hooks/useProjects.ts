'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import type { ProjectSummary } from '@/app/types/organigramme';

/**
 * Gère la liste des projets de l'utilisateur connecté, le projet actif,
 * et les opérations CRUD (créer / ouvrir / supprimer).
 * `onOpenProject` reçoit l'id du projet à charger — la logique de
 * chargement des nodes/edges reste dans useOrganigramme, ce hook ne
 * connaît que les métadonnées du projet.
 */
export function useProjects(
  session: Session | null,
  onOpenProject: (projectId: string) => Promise<void>,
  onResetCanvas: () => void
) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('Chargement...');
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [projectsModalOpen, setProjectsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Valeurs courantes lisibles depuis les callbacks différés (sauvegarde auto)
  const projectIdRef = useRef(projectId);
  const projectTitleRef = useRef(projectTitle);
  const projectListRef = useRef(projectList);
  useEffect(() => {
    projectIdRef.current = projectId;
    projectTitleRef.current = projectTitle;
    projectListRef.current = projectList;
  }, [projectId, projectTitle, projectList]);

  const refreshProjectList = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, updated_at')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement liste projets:', error.message);
      return [];
    }
    setProjectList(data || []);
    return data || [];
  }, []);

  /**
   * Appelé après chaque sauvegarde réussie de l'organigramme : enregistre
   * le titre et la date/heure de modification du projet si l'utilisateur
   * a réellement modifié quelque chose (contenu ou titre).
   */
  const markProjectSaved = useCallback(
    async ({ contentChanged }: { contentChanged: boolean }) => {
      const id = projectIdRef.current;
      if (!id) return;
      const stored = projectListRef.current.find((p) => p.id === id);
      const title = projectTitleRef.current;
      const titleChanged = !!stored && title.trim() !== '' && title !== stored.title;
      if (!contentChanged && !titleChanged) return;

      const { error } = await supabase
        .from('projects')
        .update({
          ...(titleChanged ? { title } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Erreur mise à jour du projet:', error.message);
        return;
      }
      await refreshProjectList();
    },
    [refreshProjectList]
  );

  const openProject = useCallback(
    async (project: { id: string; title: string }) => {
      onResetCanvas();
      setProjectId(project.id);
      setProjectTitle(project.title);
      await onOpenProject(project.id);
      setProjectsModalOpen(false);
      toast.success(`Projet "${project.title}" chargé`);
    },
    [onOpenProject, onResetCanvas]
  );

  const createNewProject = useCallback(async () => {
    if (!session) return;
    const { data: newProj, error } = await supabase
      .from('projects')
      .insert([{ title: 'Nouvel Organigramme', user_id: session.user.id }])
      .select()
      .single();

    if (error || !newProj) {
      toast.error('Erreur création : ' + error?.message);
      return;
    }
    await refreshProjectList();
    await openProject(newProj);
    toast.success('Nouveau projet créé');
  }, [refreshProjectList, openProject, session]);

  const confirmDeleteProject = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('projects').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      const updatedList = await refreshProjectList();
      if (deleteTarget.id === projectId) {
        if (updatedList.length > 0) {
          await openProject(updatedList[0]);
        } else {
          setProjectId(null);
          setProjectTitle('Chargement...');
          onResetCanvas();
        }
      }
      setDeleteTarget(null);
      toast.success('Projet supprimé');
    } catch (err: any) {
      toast.error('Erreur lors de la suppression : ' + err.message);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, projectId, refreshProjectList, openProject, onResetCanvas]);

  // --- Initialisation : ouvre le projet le plus récent, ou en crée un ---
  const initProjects = useCallback(async () => {
    if (!session) return;
    const projects = await refreshProjectList();
    let currentProject = projects.length > 0 ? projects[0] : null;

    if (!currentProject) {
      const { data: newProj } = await supabase
        .from('projects')
        .insert([{ title: 'Mon Organigramme', user_id: session.user.id }])
        .select()
        .single();
      currentProject = newProj;
      if (currentProject) await refreshProjectList();
    }

    if (currentProject) {
      await openProject(currentProject);
    }
  }, [session, refreshProjectList, openProject]);

  return {
    projectId,
    projectTitle,
    setProjectTitle,
    projectList,
    projectsModalOpen,
    setProjectsModalOpen,
    deleteTarget,
    setDeleteTarget,
    deleting,
    refreshProjectList,
    markProjectSaved,
    openProject,
    createNewProject,
    confirmDeleteProject,
    initProjects,
  };
}