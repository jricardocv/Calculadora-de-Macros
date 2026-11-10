import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { MealType, MealRowCalculated, SavedMeal } from '../types';

const COLLECTION_NAME = 'refeicoes';

export async function saveMealToSpreadsheet(params: {
  data: string;
  refeicao: MealType;
  itens: MealRowCalculated[];
  totalKcal: number;
  totalCarbo: number;
  totalProt: number;
  totalGord: number;
}): Promise<SavedMeal> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Usuário não autenticado no Firebase.');
  }

  const now = new Date();
  // Automatic time format HH:mm:ss
  const hora = now.toLocaleTimeString('pt-BR', { hour12: false });
  const docId = `refeicao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const path = `${COLLECTION_NAME}/${docId}`;

  const payload: SavedMeal = {
    id: docId,
    userId: user.uid,
    data: params.data,
    hora,
    refeicao: params.refeicao,
    totalKcal: Number(params.totalKcal.toFixed(1)),
    totalCarbo: Number(params.totalCarbo.toFixed(1)),
    totalProt: Number(params.totalProt.toFixed(1)),
    totalGord: Number(params.totalGord.toFixed(1)),
    itens: params.itens.map((item) => ({
      id: item.id,
      alimento: item.alimento,
      gramas: Number(item.gramas),
      kcal100g: Number(item.kcal100g),
      carbo100g: Number(item.carbo100g),
      prot100g: Number(item.prot100g),
      gord100g: Number(item.gord100g),
      kcal: Number(item.kcal.toFixed(1)),
      carbo: Number(item.carbo.toFixed(1)),
      prot: Number(item.prot.toFixed(1)),
      gord: Number(item.gord.toFixed(1)),
    })),
    createdAt: now.toISOString(),
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, docId), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeToUserMeals(
  userId: string,
  onData: (meals: SavedMeal[]) => void,
  onError?: (err: unknown) => void
) {
  // Query only records belonging to this user per security rules
  const q = query(
    collection(db, COLLECTION_NAME),
    where('userId', '==', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const meals: SavedMeal[] = [];
      snapshot.forEach((snap) => {
        meals.push(snap.data() as SavedMeal);
      });
      // Sort newest first
      meals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(meals);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  );
}

export async function deleteMealFromSpreadsheet(mealId: string): Promise<void> {
  const path = `${COLLECTION_NAME}/${mealId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, mealId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Generate TSV string for pasting directly into Google Sheets / Excel
export function formatMealTotalForClipboard(params: {
  data: string;
  hora?: string;
  refeicao: string;
  totalKcal: number;
  totalCarbo: number;
  totalProt: number;
  totalGord: number;
}): string {
  // Format Colunas A:F: Data \t Refeição \t Kcal \t Carbo \t Prot \t Gord (sem hora)
  return `${params.data}\t${params.refeicao}\t${params.totalKcal.toFixed(1).replace('.', ',')}\t${params.totalCarbo.toFixed(1).replace('.', ',')}\t${params.totalProt.toFixed(1).replace('.', ',')}\t${params.totalGord.toFixed(1).replace('.', ',')}`;
}

export function formatFoodItemsForClipboard(params: {
  data: string;
  hora: string;
  refeicao: string;
  itens: MealRowCalculated[];
}): string {
  // Format por alimento: Data \t Hora \t Refeição \t Alimento \t Gramas \t Kcal \t Carbo \t Prot \t Gord
  return params.itens
    .map(
      (item) =>
        `${params.data}\t${params.hora}\t${params.refeicao}\t${item.alimento}\t${item.gramas}\t${item.kcal.toFixed(1).replace('.', ',')}\t${item.carbo.toFixed(1).replace('.', ',')}\t${item.prot.toFixed(1).replace('.', ',')}\t${item.gord.toFixed(1).replace('.', ',')}`
    )
    .join('\n');
}
