/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Save,
  Copy,
  RotateCcw,
  FileSpreadsheet,
  Database,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Info,
  FolderOpen,
  Settings
} from 'lucide-react';
import { User } from 'firebase/auth';
import { MealType, MealItem, MealRowCalculated, AlimentoRecord, SavedMeal } from './types';
import { testConnection, initAuthSession, auth } from './firebase/config';
import {
  subscribeToFoods,
  seedInitialFoodsIfNeeded,
} from './firebase/foodsService';
import {
  saveMealToSpreadsheet,
  subscribeToUserMeals,
  formatMealTotalForClipboard,
  formatFoodItemsForClipboard
} from './firebase/mealsService';
import {
  initWorkspaceAuth,
  appendRowToGoogleSheet,
  getCachedAccessToken,
  setCachedAccessToken,
  getOrRefreshToken
} from './services/googleDriveService';
import { MealRow } from './components/MealRow';
import { NewFoodModal } from './components/NewFoodModal';
import { SpreadsheetModal } from './components/SpreadsheetModal';
import { GoogleSheetsConfigModal } from './components/GoogleSheetsConfigModal';
import { ConfirmAppendModal } from './components/ConfirmAppendModal';

const MEAL_TYPES: MealType[] = [
  'Café da manhã',
  'Lanche da manhã',
  'Almoço',
  'Lanche da tarde',
  'Jantar',
  'Ceia'
];

export default function App() {
  const getTodayFormatted = () => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    return `${d}/${m}/${y}`;
  };

  const [dataRefeicao, setDataRefeicao] = useState<string>(getTodayFormatted());
  const [tipoRefeicao, setTipoRefeicao] = useState<MealType>('Almoço');

  // Meal rows state
  const [items, setItems] = useState<MealItem[]>([
    {
      id: 'item_1',
      alimento: '',
      gramas: '',
      kcal100g: '',
      carbo100g: '',
      prot100g: '',
      gord100g: ''
    }
  ]);

  // Firebase state
  const [foods, setFoods] = useState<AlimentoRecord[]>([]);
  const [userMeals, setUserMeals] = useState<SavedMeal[]>([]);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);

  // Google Workspace (Drive & Sheets) integration state
  const [googleToken, setGoogleToken] = useState<string | null>(getCachedAccessToken());
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('gdrive_spreadsheet_id') || '';
  });
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>(() => {
    return localStorage.getItem('gdrive_spreadsheet_title') || '';
  });
  const [sheetName, setSheetName] = useState<string>(() => {
    return localStorage.getItem('gdrive_sheet_name') || 'Página1';
  });
  const [columnFormat, setColumnFormat] = useState<'data_hora_refeicao' | 'data_refeicao_macros'>(() => {
    return (localStorage.getItem('gdrive_column_format') as any) || 'data_hora_refeicao';
  });

  // Modals state
  const [isNewFoodModalOpen, setIsNewFoodModalOpen] = useState(false);
  const [newFoodInitialName, setNewFoodInitialName] = useState('');
  const [isSpreadsheetModalOpen, setIsSpreadsheetModalOpen] = useState(false);
  const [isGoogleSheetsModalOpen, setIsGoogleSheetsModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalError, setConfirmModalError] = useState<string | null>(null);
  const [pendingRowValues, setPendingRowValues] = useState<(string | number)[]>([]);
  const [appendingToSheet, setAppendingToSheet] = useState(false);

  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error' | null;
    message?: string;
  }>({ type: null });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Initialize Firebase connection and session
  useEffect(() => {
    testConnection().then((connected) => {
      setDbConnected(connected);
    });

    const unsubscribeAuth = initAuthSession((user) => {
      setCurrentUser(user);
    });

    const unsubscribeWorkspace = initWorkspaceAuth(
      (user, token) => {
        setCurrentUser(user);
        setGoogleToken(token);
      },
      () => {
        setGoogleToken(null);
      }
    );

    return () => {
      unsubscribeAuth();
      unsubscribeWorkspace();
    };
  }, []);

  // Subscribe to foods database from Firestore
  useEffect(() => {
    const unsubscribeFoods = subscribeToFoods(
      (loadedFoods) => {
        setFoods(loadedFoods);
        if (loadedFoods.length === 0 && !seeding) {
          setSeeding(true);
          seedInitialFoodsIfNeeded(false).finally(() => {
            setSeeding(false);
          });
        }
      },
      (err) => {
        console.error('Error fetching foods from Firestore:', err);
      }
    );

    return () => {
      unsubscribeFoods();
    };
  }, []);

  // Subscribe to saved meals for current user
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribeMeals = subscribeToUserMeals(
      currentUser.uid,
      (meals) => {
        setUserMeals(meals);
      },
      (err) => {
        console.error('Error fetching user meals:', err);
      }
    );

    return () => {
      unsubscribeMeals();
    };
  }, [currentUser]);

  // Calculate totals
  const calculatedItems = useMemo((): MealRowCalculated[] => {
    return items.map((item) => {
      const g = typeof item.gramas === 'number' ? item.gramas : 0;
      const k100 = typeof item.kcal100g === 'number' ? item.kcal100g : 0;
      const c100 = typeof item.carbo100g === 'number' ? item.carbo100g : 0;
      const p100 = typeof item.prot100g === 'number' ? item.prot100g : 0;
      const f100 = typeof item.gord100g === 'number' ? item.gord100g : 0;

      const factor = g > 0 ? g / 100 : 0;
      return {
        id: item.id,
        alimento: item.alimento,
        gramas: g,
        kcal100g: k100,
        carbo100g: c100,
        prot100g: p100,
        gord100g: f100,
        kcal: factor * k100,
        carbo: factor * c100,
        prot: factor * p100,
        gord: factor * f100,
      };
    });
  }, [items]);

  const totals = useMemo(() => {
    return calculatedItems.reduce(
      (acc, item) => ({
        kcal: acc.kcal + item.kcal,
        carbo: acc.carbo + item.carbo,
        prot: acc.prot + item.prot,
        gord: acc.gord + item.gord,
      }),
      { kcal: 0, carbo: 0, prot: 0, gord: 0 }
    );
  }, [calculatedItems]);

  const handleAddRow = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        alimento: '',
        gramas: '',
        kcal100g: '',
        carbo100g: '',
        prot100g: '',
        gord100g: '',
      },
    ]);
  };

  const handleUpdateRow = (index: number, updated: MealItem) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (items.length === 1) {
      setItems([
        {
          id: `item_${Date.now()}`,
          alimento: '',
          gramas: '',
          kcal100g: '',
          carbo100g: '',
          prot100g: '',
          gord100g: '',
        },
      ]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearMeal = () => {
    setItems([
      {
        id: `item_${Date.now()}`,
        alimento: '',
        gramas: '',
        kcal100g: '',
        carbo100g: '',
        prot100g: '',
        gord100g: '',
      },
    ]);
    setSaveStatus({ type: null });
    setCopyFeedback(null);
  };

  // Generate row values for columns A:F (Apenas Data, Refeição, Kcal, Carbo, Prot, Gord)
  const generateRowForColumnsAF = (): (string | number)[] => {
    return [
      dataRefeicao,
      tipoRefeicao,
      Math.round(totals.kcal),
      Number(totals.carbo.toFixed(1)),
      Number(totals.prot.toFixed(1)),
      Number(totals.gord.toFixed(1)),
    ];
  };

  // Click on "Salvar na planilha"
  const handleSaveToSpreadsheetClick = async () => {
    const validItems = calculatedItems.filter(
      (it) => it.alimento.trim() !== '' && it.gramas > 0
    );

    if (validItems.length === 0) {
      setSaveStatus({
        type: 'error',
        message: 'Adicione pelo menos um alimento com peso em gramas antes de salvar.',
      });
      setTimeout(() => setSaveStatus({ type: null }), 3500);
      return;
    }

    // If Google Drive sheet is configured, automatically obtain/use token and open confirmation
    if (spreadsheetId) {
      setConfirmModalError(null);
      let token = googleToken || getCachedAccessToken();
      if (!token) {
        try {
          token = await getOrRefreshToken();
          setGoogleToken(token);
          setCachedAccessToken(token);
        } catch {
          setIsGoogleSheetsModalOpen(true);
          return;
        }
      }
      const rowValues = generateRowForColumnsAF();
      setPendingRowValues(rowValues);
      setIsConfirmModalOpen(true);
      return;
    }

    // If Google Drive sheet is not configured yet, prompt Google Sheets modal
    setIsGoogleSheetsModalOpen(true);
  };

  // User confirmed action in ConfirmAppendModal
  const handleConfirmSaveToGoogleSheet = async () => {
    let token = googleToken || getCachedAccessToken();
    if (!token) {
      try {
        token = await getOrRefreshToken();
        setGoogleToken(token);
        setCachedAccessToken(token);
      } catch (err) {
        setConfirmModalError(
          err instanceof Error
            ? err.message
            : 'Reconecte sua conta Google para continuar.'
        );
        return;
      }
    }

    if (!spreadsheetId) {
      setIsConfirmModalOpen(false);
      setIsGoogleSheetsModalOpen(true);
      return;
    }

    setAppendingToSheet(true);
    setConfirmModalError(null);
    const validItems = calculatedItems.filter(
      (it) => it.alimento.trim() !== '' && it.gramas > 0
    );

    try {
      // 1. Append directly to Google Drive Spreadsheet columns A:F
      await appendRowToGoogleSheet({
        spreadsheetId,
        sheetName,
        rowValues: pendingRowValues,
        accessToken: token,
      });

      // 2. Also record in Firebase Firestore database
      await saveMealToSpreadsheet({
        data: dataRefeicao,
        refeicao: tipoRefeicao,
        itens: validItems,
        totalKcal: totals.kcal,
        totalCarbo: totals.carbo,
        totalProt: totals.prot,
        totalGord: totals.gord,
      });

      setIsConfirmModalOpen(false);
      setSaveStatus({
        type: 'success',
        message: `Gravado com sucesso nas colunas A:F da planilha "${spreadsheetTitle || 'Google Sheets'}"!`,
      });
      setTimeout(() => setSaveStatus({ type: null }), 4500);
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Erro ao gravar na planilha do Google Drive.';
      setConfirmModalError(msg);
      setSaveStatus({
        type: 'error',
        message: msg,
      });
    } finally {
      setAppendingToSheet(false);
    }
  };

  const handleCopyTotal = async () => {
    const text = formatMealTotalForClipboard({
      data: dataRefeicao,
      refeicao: tipoRefeicao,
      totalKcal: totals.kcal,
      totalCarbo: totals.carbo,
      totalProt: totals.prot,
      totalGord: totals.gord,
    });

    await navigator.clipboard.writeText(text);
    setCopyFeedback('Total copiado no formato de planilha (Colunas A:F)!');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleCopyPerFood = async () => {
    const validItems = calculatedItems.filter(
      (it) => it.alimento.trim() !== '' && it.gramas > 0
    );

    if (validItems.length === 0) {
      setCopyFeedback('Nenhum alimento preenchido para copiar.');
      setTimeout(() => setCopyFeedback(null), 2500);
      return;
    }

    const now = new Date();
    const hora = now.toLocaleTimeString('pt-BR', { hour12: false });
    const text = formatFoodItemsForClipboard({
      data: dataRefeicao,
      hora,
      refeicao: tipoRefeicao,
      itens: validItems,
    });

    await navigator.clipboard.writeText(text);
    setCopyFeedback('Linhas por alimento copiadas para colar na coluna A!');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleSaveGoogleConfig = (params: {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columnFormat: 'data_hora_refeicao' | 'data_refeicao_macros';
  }) => {
    setSpreadsheetId(params.spreadsheetId);
    setSpreadsheetTitle(params.spreadsheetTitle);
    setSheetName(params.sheetName);
    setColumnFormat(params.columnFormat);
    localStorage.setItem('gdrive_spreadsheet_id', params.spreadsheetId);
    localStorage.setItem('gdrive_spreadsheet_title', params.spreadsheetTitle);
    localStorage.setItem('gdrive_sheet_name', params.sheetName);
    localStorage.setItem('gdrive_column_format', params.columnFormat);
  };

  return (
    <div className="min-h-screen bg-[#0e1719] text-slate-100 flex flex-col justify-between selection:bg-teal-500/30 w-full overflow-x-hidden">
      {/* Top Banner / Header */}
      <header className="border-b border-[#1c3035] bg-[#0c1416]/90 backdrop-blur-md sticky top-0 z-30 w-full">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          {/* Title without icon */}
          <h1 className="text-sm sm:text-lg font-bold text-slate-100 tracking-tight shrink-0">
            Calculadora de macros
          </h1>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Google Drive Sheet Connection status / button */}
            <button
              onClick={() => setIsGoogleSheetsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-medium transition cursor-pointer max-w-[145px] sm:max-w-[220px] ${
                googleToken && spreadsheetId
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                  : 'bg-[#172b30] border-[#25424b] text-slate-300 hover:bg-[#1e373e]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">
                {googleToken && spreadsheetId
                  ? spreadsheetTitle || 'Planilha (A:F)'
                  : 'Conectar Planilha'}
              </span>
              <Settings className="w-3 h-3 text-slate-400 shrink-0 ml-0.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Top Control Card: Data e Refeição */}
        <section className="bg-[#132226] border border-[#223940] rounded-2xl p-4 sm:p-5 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Data input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Data
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={dataRefeicao}
                  onChange={(e) => setDataRefeicao(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full bg-[#172a2f] border border-[#27424a] rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition"
                />
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Refeição selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Refeição
              </label>
              <div className="relative">
                <select
                  value={tipoRefeicao}
                  onChange={(e) => setTipoRefeicao(e.target.value as MealType)}
                  className="w-full bg-[#172a2f] border border-[#27424a] rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-100 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition appearance-none cursor-pointer"
                >
                  {MEAL_TYPES.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-[#142327]">
                      {tipo}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>
          </div>
        </section>

        {/* Meal Table Card with Perfect Column Alignment */}
        <section className="bg-[#132226] border border-[#223940] rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
          {/* Scrollable table container matching original layout */}
          <div className="overflow-x-auto pb-2">
            <div className="min-w-[780px] space-y-2">
              {/* Table Column Headers */}
              <div className="flex items-center gap-3 px-1 text-xs font-semibold text-slate-400 border-b border-[#1f353c] pb-2.5">
                <div className="w-[230px] shrink-0">Alimento</div>
                <div className="w-[88px] shrink-0 text-center">Gramas</div>
                <div className="w-[88px] shrink-0 text-center">kcal/100 g</div>
                <div className="w-[88px] shrink-0 text-center">Carbo/100 g</div>
                <div className="w-[88px] shrink-0 text-center">Prot/100 g</div>
                <div className="w-[88px] shrink-0 text-center">Gord/100 g</div>
                <div className="w-[68px] shrink-0 text-right pr-1">kcal</div>
                <div className="w-[36px] shrink-0"></div>
              </div>

              {/* Rows List */}
              <div className="space-y-1.5">
                {items.map((item, index) => (
                  <MealRow
                    key={item.id}
                    item={item}
                    foodsDatabase={foods}
                    onUpdate={(updated) => handleUpdateRow(index, updated)}
                    onRemove={() => handleRemoveRow(index)}
                    onOpenNewFoodModal={(name) => {
                      setNewFoodInitialName(name);
                      setIsNewFoodModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons below table */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#1e343b]">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#182c31] hover:bg-[#203a41] text-slate-200 border border-[#284650] text-sm font-semibold transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-400" />
                Adicionar alimento
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewFoodInitialName('');
                  setIsNewFoodModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#142428] hover:bg-[#1a3036] text-teal-400 border border-teal-500/20 text-xs font-medium transition cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                + Cadastrar novo alimento no Firebase
              </button>
            </div>

            <span className="text-xs text-slate-400 font-mono">
              {calculatedItems.filter((i) => i.alimento && i.gramas > 0).length} alimento(s) montado(s)
            </span>
          </div>

          {/* Explanatory text matching user's spec */}
          <div className="bg-[#0f1a1d] border border-[#1b2f34] rounded-xl p-3.5 text-xs text-slate-400 leading-relaxed flex items-start gap-2.5">
            <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
            <p>
              Escolha um item da lista ou digite outro. Na primeira vez, preencha os valores por 100 g (rótulo ou tabela que você usa).
              Eles ficam salvos e aparecem sozinhos nas próximas vezes; o botão Salvar registra o alimento na hora e o inclui na lista de sugestões.
              Aceita vírgula ou ponto. Seus alimentos salvos ficam na sua conta e aparecem em qualquer navegador ou aparelho onde você abrir este link logado.
            </p>
          </div>
        </section>

        {/* Totals Summary Cards */}
        <section className="bg-[#132226] border border-[#223940] rounded-2xl p-4 sm:p-6 shadow-lg space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Calorias */}
            <div className="bg-[#172a2f] border border-[#26444c] rounded-xl p-4 sm:p-5">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-100 font-mono tracking-tight block">
                {Math.round(totals.kcal)}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 mt-1 block">
                Calorias (kcal)
              </span>
            </div>

            {/* Carboidratos */}
            <div className="bg-[#172a2f] border border-[#26444c] rounded-xl p-4 sm:p-5">
              <span className="text-3xl sm:text-4xl font-extrabold text-amber-300 font-mono tracking-tight block">
                {totals.carbo.toFixed(1).replace('.0', '')}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 mt-1 block">
                Carboidratos (g)
              </span>
            </div>

            {/* Proteína */}
            <div className="bg-[#172a2f] border border-[#26444c] rounded-xl p-4 sm:p-5">
              <span className="text-3xl sm:text-4xl font-extrabold text-sky-300 font-mono tracking-tight block">
                {totals.prot.toFixed(1).replace('.0', '')}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 mt-1 block">
                Proteína (g)
              </span>
            </div>

            {/* Gordura */}
            <div className="bg-[#172a2f] border border-[#26444c] rounded-xl p-4 sm:p-5">
              <span className="text-3xl sm:text-4xl font-extrabold text-rose-300 font-mono tracking-tight block">
                {totals.gord.toFixed(1).replace('.0', '')}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-slate-300 mt-1 block">
                Gordura (g)
              </span>
            </div>
          </div>

          {/* Status Alert */}
          {saveStatus.type && (
            <div
              className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm animate-in fade-in slide-in-from-top-1 ${
                saveStatus.type === 'success'
                  ? 'bg-teal-950/40 border-teal-500/40 text-teal-200'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
              }`}
            >
              {saveStatus.type === 'success' ? (
                <Check className="w-4 h-4 text-teal-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="font-medium">{saveStatus.message}</span>
            </div>
          )}

          {copyFeedback && (
            <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/40 text-teal-200 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 text-teal-400" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* Action Buttons: "Salvar na planilha", "Copiar por alimento", "Limpar refeição" */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {/* Primary replacement: "Salvar na planilha" */}
            <button
              type="button"
              onClick={handleSaveToSpreadsheetClick}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2dd4bf] hover:bg-[#14b8a6] text-[#0a181b] font-bold text-sm sm:text-base shadow-lg shadow-teal-500/20 active:scale-98 transition cursor-pointer"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
              Salvar na planilha
            </button>

            {/* Copiar por alimento */}
            <button
              type="button"
              onClick={handleCopyPerFood}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#172a2f] hover:bg-[#1f373e] text-slate-200 border border-[#27454f] font-semibold text-sm transition cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              Copiar por alimento
            </button>

            {/* Copiar total da refeição */}
            <button
              type="button"
              onClick={handleCopyTotal}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#172a2f] hover:bg-[#1f373e] text-slate-300 border border-[#27454f] font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              <Copy className="w-4 h-4" />
              Copiar total
            </button>

            {/* Limpar refeição */}
            <button
              type="button"
              onClick={handleClearMeal}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#172a2f] hover:bg-[#1f373e] text-slate-400 hover:text-slate-200 border border-[#27454f] font-medium text-xs sm:text-sm transition ml-auto cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Limpar refeição
            </button>
          </div>

          {/* Footer instruction text matching image */}
          <p className="text-xs text-slate-400/90 leading-relaxed pt-2 border-t border-[#1c3238]">
            Total da refeição: data, refeição, kcal, carboidratos, proteína, gordura. Por alimento: data, refeição, alimento, gramas, kcal, carboidratos, proteína, gordura. Atualização direta nas colunas A:F da sua planilha do Google Drive.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c3035] bg-[#0c1416] py-4 text-center text-xs text-slate-500">
        <p>
          Calculadora de Macros com Banco Firebase e integração Google Drive Planilhas (Colunas A:F)
        </p>
      </footer>

      {/* New Food Modal */}
      <NewFoodModal
        isOpen={isNewFoodModalOpen}
        onClose={() => setIsNewFoodModalOpen(false)}
        initialName={newFoodInitialName}
        onFoodAdded={(newFood) => {
          setFoods((prev) => [newFood, ...prev]);
        }}
      />

      {/* Spreadsheet History Modal */}
      <SpreadsheetModal
        isOpen={isSpreadsheetModalOpen}
        onClose={() => setIsSpreadsheetModalOpen(false)}
        meals={userMeals}
      />

      {/* Google Sheets Config Modal */}
      <GoogleSheetsConfigModal
        isOpen={isGoogleSheetsModalOpen}
        onClose={() => setIsGoogleSheetsModalOpen(false)}
        currentUser={currentUser}
        accessToken={googleToken}
        onTokenUpdated={(user, token) => {
          setCurrentUser(user);
          setGoogleToken(token);
          setCachedAccessToken(token);
        }}
        selectedSpreadsheetId={spreadsheetId}
        selectedSheetName={sheetName}
        columnFormat={columnFormat}
        onSaveConfig={handleSaveGoogleConfig}
      />

      {/* Confirm Save to Google Sheets Modal (Mandatory User Confirmation) */}
      <ConfirmAppendModal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          setIsConfirmModalOpen(false);
          setConfirmModalError(null);
        }}
        onConfirm={handleConfirmSaveToGoogleSheet}
        spreadsheetTitle={spreadsheetTitle}
        sheetName={sheetName}
        rowValues={pendingRowValues}
        loading={appendingToSheet}
        error={confirmModalError}
      />
    </div>
  );
}
