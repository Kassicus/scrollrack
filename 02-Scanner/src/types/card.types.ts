export interface CardEntry {
  id: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  quantity: number;
  foilQuantity: number;
  imageUri: string;
  manaCost: string;
  typeLine: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';
  priceUsd: number | null;
  priceFoilUsd: number | null;
  dateAdded: Date;
  dateModified: Date;
}

export interface ScanHistoryEntry {
  id: string;
  cardId: string;
  timestamp: Date;
  confidence: number;
  wasManualEntry: boolean;
}

export type ViewMode = 'scan' | 'collection' | 'settings';
