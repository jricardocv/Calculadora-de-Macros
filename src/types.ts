export type MealType =
  | 'Café da manhã'
  | 'Lanche da manhã'
  | 'Almoço'
  | 'Lanche da tarde'
  | 'Jantar'
  | 'Ceia';

export interface AlimentoRecord {
  id: string;
  nome: string;
  kcal100g: number;
  carbo100g: number;
  prot100g: number;
  gord100g: number;
  fonte?: 'manual' | 'taco' | 'usuario';
  userId?: string;
  createdAt?: string;
}

export interface MealItem {
  id: string;
  alimento: string;
  gramas: number | '';
  kcal100g: number | '';
  carbo100g: number | '';
  prot100g: number | '';
  gord100g: number | '';
  fonte?: string;
}

export interface MealRowCalculated {
  id: string;
  alimento: string;
  gramas: number;
  kcal100g: number;
  carbo100g: number;
  prot100g: number;
  gord100g: number;
  kcal: number;
  carbo: number;
  prot: number;
  gord: number;
}

export interface SavedMeal {
  id: string;
  userId: string;
  data: string; // DD/MM/YYYY or YYYY-MM-DD
  hora: string; // HH:mm:ss
  refeicao: MealType;
  totalKcal: number;
  totalCarbo: number;
  totalProt: number;
  totalGord: number;
  itens: MealRowCalculated[];
  createdAt: string;
  observacao?: string;
}
