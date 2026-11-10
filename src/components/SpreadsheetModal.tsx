import React, { useState } from 'react';
import {
  X,
  Table,
  Copy,
  Trash2,
  Download,
  Calendar,
  Clock,
  Check,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { SavedMeal } from '../types';
import { deleteMealFromSpreadsheet, formatMealTotalForClipboard } from '../firebase/mealsService';

interface SpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  meals: SavedMeal[];
}

export const SpreadsheetModal: React.FC<SpreadsheetModalProps> = ({
  isOpen,
  onClose,
  meals,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState<string>('');

  if (!isOpen) return null;

  const filteredMeals = filterDate
    ? meals.filter((m) => m.data === filterDate)
    : meals;

  const handleCopySingle = async (meal: SavedMeal) => {
    const text = formatMealTotalForClipboard({
      data: meal.data,
      refeicao: meal.refeicao,
      totalKcal: meal.totalKcal,
      totalCarbo: meal.totalCarbo,
      totalProt: meal.totalProt,
      totalGord: meal.totalGord,
    });
    await navigator.clipboard.writeText(text);
    setCopiedId(meal.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = async () => {
    if (filteredMeals.length === 0) return;
    const header = 'Data\tRefeição\tCalorias (kcal)\tCarboidratos (g)\tProteína (g)\tGordura (g)';
    const rows = filteredMeals.map((m) =>
      formatMealTotalForClipboard({
        data: m.data,
        refeicao: m.refeicao,
        totalKcal: m.totalKcal,
        totalCarbo: m.totalCarbo,
        totalProt: m.totalProt,
        totalGord: m.totalGord,
      })
    );
    const content = [header, ...rows].join('\n');
    await navigator.clipboard.writeText(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (filteredMeals.length === 0) return;
    const header = 'Data;Hora;Refeição;Kcal;Carboidratos;Proteína;Gordura;Itens';
    const rows = filteredMeals.map((m) => {
      const itemsStr = m.itens.map((it) => `${it.alimento} (${it.gramas}g)`).join(' | ');
      return `${m.data};${m.hora};${m.refeicao};${m.totalKcal};${m.totalCarbo};${m.totalProt};${m.totalGord};"${itemsStr}"`;
    });
    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `refeicoes_planilha_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Deseja excluir este registro da planilha?')) {
      try {
        await deleteMealFromSpreadsheet(id);
      } catch (err) {
        console.error('Erro ao deletar refeição:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#121f23] border border-[#233c44] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20363d] bg-[#0e191c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-lg">
                Planilha de Refeições (Banco Firebase)
              </h2>
              <p className="text-xs text-slate-400">
                Registros sincronizados em tempo real com data e hora automática.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-xl hover:bg-[#182a2e] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-[#1c3036] bg-[#142327]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Filtrar por data:</span>
            <input
              type="text"
              placeholder="Ex: 09/11/2026"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-[#18282d] border border-[#273e46] rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-400"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs text-teal-400 hover:underline"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopyAll}
              disabled={filteredMeals.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1d3036] hover:bg-[#253e46] text-slate-200 border border-[#2a454e] transition disabled:opacity-40"
            >
              {copiedAll ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-400" />
                  Copiado para Google Sheets!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copiar tudo para Planilha
                </>
              )}
            </button>
            <button
              onClick={handleDownloadCsv}
              disabled={filteredMeals.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-400 hover:bg-teal-300 text-[#0c181b] transition disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar CSV
            </button>
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {filteredMeals.length === 0 ? (
            <div className="text-center py-16 text-slate-500 space-y-2">
              <Table className="w-12 h-12 mx-auto stroke-1 opacity-40 text-slate-400" />
              <p className="text-sm font-medium text-slate-400">Nenhuma refeição salva na planilha ainda.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Monte sua refeição na calculadora e clique em "Salvar na planilha" para registrar com data e hora automáticas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeals.map((meal) => {
                const isExpanded = expandedMealId === meal.id;
                return (
                  <div
                    key={meal.id}
                    className="bg-[#17272b] border border-[#243c44] rounded-xl overflow-hidden transition hover:border-[#2f4f5a]"
                  >
                    <div className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-[#121e21] px-2.5 py-1 rounded-lg border border-[#20353b]">
                          <Calendar className="w-3.5 h-3.5 text-teal-400" />
                          <span>{meal.data}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-teal-300/90 font-mono bg-[#121e21] px-2.5 py-1 rounded-lg border border-[#20353b]">
                          <Clock className="w-3.5 h-3.5 text-teal-400" />
                          <span>{meal.hora}</span>
                        </div>
                        <span className="font-semibold text-slate-200 text-sm">
                          {meal.refeicao}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-slate-100 font-bold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                            {meal.totalKcal} kcal
                          </span>
                          <span className="text-amber-300 hidden sm:inline">
                            C: {meal.totalCarbo}g
                          </span>
                          <span className="text-blue-300 hidden sm:inline">
                            P: {meal.totalProt}g
                          </span>
                          <span className="text-rose-300 hidden sm:inline">
                            G: {meal.totalGord}g
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopySingle(meal)}
                            title="Copiar linha para colar na planilha"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-[#20363d] transition"
                          >
                            {copiedId === meal.id ? (
                              <Check className="w-4 h-4 text-teal-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setExpandedMealId(isExpanded ? null : meal.id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#20363d] transition"
                            title="Ver alimentos"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(meal.id)}
                            title="Excluir refeição"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 py-3 bg-[#111c1f] border-t border-[#20363d] text-xs">
                        <p className="text-slate-400 font-medium mb-2">Itens da refeição:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {meal.itens.map((it, idx) => (
                            <div
                              key={idx}
                              className="bg-[#17272b] p-2 rounded-lg border border-[#243c44] flex justify-between items-center"
                            >
                              <div>
                                <span className="font-medium text-slate-200">{it.alimento}</span>
                                <span className="text-slate-400 ml-1.5">({it.gramas}g)</span>
                              </div>
                              <div className="text-[11px] text-teal-300/80 font-mono">
                                {it.kcal} kcal
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-[#1f333a] bg-[#0e191c] flex items-center justify-between text-xs text-slate-400">
          <span>{filteredMeals.length} refeição(ões) registrada(s)</span>
          <span className="hidden sm:inline">Cole na coluna A da planilha do Google ou Excel</span>
        </div>
      </div>
    </div>
  );
};
