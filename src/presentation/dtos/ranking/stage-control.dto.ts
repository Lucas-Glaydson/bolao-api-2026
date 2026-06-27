export class StageControlDto {
  id: string;
  stage: string;
  isOpen: boolean;
  openedAt: Date | null;
  closedAt: Date | null;
  allowPredictions: boolean;
  displayOrder: number;
}
