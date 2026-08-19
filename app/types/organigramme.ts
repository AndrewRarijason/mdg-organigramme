export interface CustomNodeData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  photoUrl: string;
  layoutSide?: 'left' | 'right' | null;
  isShortestDistance?: boolean;
  onChange: (id: string, field: string, value: string) => void;
  onPhotoUpload: (id: string, file: File) => void;
  onDeleteNode: (id: string) => void;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updated_at: string;
}
