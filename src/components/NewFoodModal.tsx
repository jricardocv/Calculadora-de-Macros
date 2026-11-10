import React, { useState } from 'react';
import { X, Plus, Sparkles, Check, Database } from 'lucide-react';
import { AlimentoRecord } from '../types';
import { saveFoodToFirestore } from '../firebase/foodsService';

interface NewFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFoodAdded: (food: AlimentoRecord) => void;
  initialName?: string;
}

export const NewFoodModal: React.FC<NewFoodModalProps> = ({
  isOpen,
  onClose,
  onFoodAdded,
  initialName = '',
}) => {
  const [nome, setNome] = useState(initialName);
  const [kcal100g, setKcal100g] = useState('');
  const [carbo100g, setCarbo100g] = useState('');
  const [prot100g, setProt100g] = useState('');
  const [gord100g, setGord100g] = useState('');
  const [fonte, setFonte] = useState<'usuario' | 'manual' | 'taco'>('usuario');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const parseNumber = (val: string): number => {
    const cleaned = val.replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError('Por favor, informe o nome do alimento.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const saved = await saveFoodToFirestore({
        nome: nome.trim(),
        kcal100g: parseNumber(kcal100g),
        carbo100g: parseNumber(carbo100g),
        prot100g: parseNumber(prot100g),
        gord100g: parseNumber(gord100g),
        fonte,
      });

      setSuccess(true);
      onFoodAdded(saved);
      setTimeout(() => {
        setSuccess(false);
        setNome('');
        setKcal100g('');
        setCarbo100g('');
        setProt100g('');
        setGord100g('');
        onClose();
      }, 700);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Falha ao salvar no Firebase');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#142125] border border-[#253d45] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22373e] bg-[#111c1f]">
          <div className="flex items-center gap-2 text-teal-400">
            <Database className="w-5 h-5" />
            <h3 className="font-semibold text-slate-100 text-lg">Novo Alimento no Firebase</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#1a2d32] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-400">
            Cadastre os valores por <span className="text-teal-300 font-medium">100g</span> do rótulo ou tabela.
            O alimento será salvo diretamente no banco de dados do Firebase.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Nome do alimento *
            </label>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Pão integral 7 grãos, Shake de baunilha..."
              className="w-full bg-[#18282d] border border-[#263e46] rounded-xl px-3.5 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                kcal / 100g
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={kcal100g}
                onChange={(e) => setKcal100g(e.target.value)}
                placeholder="0"
                className="w-full bg-[#18282d] border border-[#263e46] rounded-xl px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Carbo / 100g
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={carbo100g}
                onChange={(e) => setCarbo100g(e.target.value)}
                placeholder="0 g"
                className="w-full bg-[#18282d] border border-[#263e46] rounded-xl px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Prot / 100g
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={prot100g}
                onChange={(e) => setProt100g(e.target.value)}
                placeholder="0 g"
                className="w-full bg-[#18282d] border border-[#263e46] rounded-xl px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Gord / 100g
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={gord100g}
                onChange={(e) => setGord100g(e.target.value)}
                placeholder="0 g"
                className="w-full bg-[#18282d] border border-[#263e46] rounded-xl px-3 py-2 text-slate-100 text-sm text-center focus:outline-none focus:border-teal-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Origem dos dados
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFonte('usuario')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                  fonte === 'usuario'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                    : 'bg-[#18282d] text-slate-400 border-[#263e46] hover:text-slate-200'
                }`}
              >
                Personalizado / Rótulo
              </button>
              <button
                type="button"
                onClick={() => setFonte('taco')}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition ${
                  fonte === 'taco'
                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                    : 'bg-[#18282d] text-slate-400 border-[#263e46] hover:text-slate-200'
                }`}
              >
                Tabela TACO
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-[#1a2c31] transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-teal-400 hover:bg-teal-300 text-[#0c181b] transition disabled:opacity-50"
            >
              {success ? (
                <>
                  <Check className="w-4 h-4 text-emerald-950" />
                  Salvo no Firebase!
                </>
              ) : loading ? (
                'Salvando...'
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Salvar no Firebase
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
