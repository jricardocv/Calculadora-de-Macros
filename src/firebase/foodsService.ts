import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { AlimentoRecord } from '../types';
import { ALL_INITIAL_FOODS } from '../data/seedData';

const COLLECTION_NAME = 'alimentos';

export function sanitizeFoodDocId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

// Real-time listener for all foods stored in Firebase Firestore
export function subscribeToFoods(
  onData: (foods: AlimentoRecord[]) => void,
  onError?: (err: unknown) => void
) {
  const colRef = collection(db, COLLECTION_NAME);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const foods: AlimentoRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        foods.push({
          id: docSnap.id,
          nome: data.nome || docSnap.id,
          kcal100g: Number(data.kcal100g) || 0,
          carbo100g: Number(data.carbo100g) || 0,
          prot100g: Number(data.prot100g) || 0,
          gord100g: Number(data.gord100g) || 0,
          fonte: data.fonte || 'manual',
          userId: data.userId,
          createdAt: data.createdAt,
        });
      });
      // Sort alphabetically
      foods.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
      onData(foods);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
    }
  );
}

// Fetch foods once directly from Firestore
export async function getFoodsFromFirestore(): Promise<AlimentoRecord[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION_NAME));
    const list: AlimentoRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        nome: data.nome || docSnap.id,
        kcal100g: Number(data.kcal100g) || 0,
        carbo100g: Number(data.carbo100g) || 0,
        prot100g: Number(data.prot100g) || 0,
        gord100g: Number(data.gord100g) || 0,
        fonte: data.fonte || 'manual',
        userId: data.userId,
        createdAt: data.createdAt,
      });
    });
    list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
  }
}

// Seed the initial database if it is empty
export async function seedInitialFoodsIfNeeded(
  force: boolean = false,
  onProgress?: (saved: number, total: number) => void
): Promise<number> {
  try {
    const existingSnap = await getDocs(collection(db, COLLECTION_NAME));
    if (!force && !existingSnap.empty) {
      return existingSnap.size;
    }

    const total = ALL_INITIAL_FOODS.length;
    let count = 0;
    const batchSize = 100;

    for (let i = 0; i < total; i += batchSize) {
      const chunk = ALL_INITIAL_FOODS.slice(i, i + batchSize);
      const batch = writeBatch(db);

      for (const item of chunk) {
        const docId = sanitizeFoodDocId(item.nome);
        const docRef = doc(db, COLLECTION_NAME, docId);
        batch.set(docRef, {
          nome: item.nome.trim(),
          kcal100g: item.kcal100g,
          carbo100g: item.carbo100g,
          prot100g: item.prot100g,
          gord100g: item.gord100g,
          fonte: item.fonte || 'manual',
          createdAt: new Date().toISOString(),
        });
        count++;
      }

      await batch.commit();
      if (onProgress) onProgress(count, total);
    }

    return count;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTION_NAME);
  }
}

// Add or update a food in Firestore
export async function saveFoodToFirestore(
  food: Omit<AlimentoRecord, 'id'>,
  customId?: string
): Promise<AlimentoRecord> {
  const docId = customId || sanitizeFoodDocId(food.nome);
  const path = `${COLLECTION_NAME}/${docId}`;
  try {
    const payload = {
      nome: food.nome.trim(),
      kcal100g: Number(food.kcal100g) || 0,
      carbo100g: Number(food.carbo100g) || 0,
      prot100g: Number(food.prot100g) || 0,
      gord100g: Number(food.gord100g) || 0,
      fonte: food.fonte || 'usuario',
      userId: auth.currentUser?.uid || 'anon',
      createdAt: food.createdAt || new Date().toISOString(),
    };
    await setDoc(doc(db, COLLECTION_NAME, docId), payload);
    return {
      id: docId,
      ...payload,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Delete food
export async function deleteFoodFromFirestore(docId: string): Promise<void> {
  const path = `${COLLECTION_NAME}/${docId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
