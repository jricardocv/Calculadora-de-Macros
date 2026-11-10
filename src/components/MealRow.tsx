import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Plus, Sparkles, BookOpen } from 'lucide-react';
import { AlimentoRecord, MealItem } from '../types';

interface MealRowProps {
  item: MealItem;
  foodsDatabase: AlimentoRecord[];
  onUpdate: (updated: MealItem) => void;
  onRemove: () => void;
  onOpenNewFoodModal: (prefillName: string) => void;
}

export const MealRow: React.FC<MealRowProps> = ({
  item,
  foodsDatabase,
  onUpdate,
  onRemove,
  onOpenNewFoodModal,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(item.alimento);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  // Sync searchTerm when item.alimento changes externally
  useEffect(() => {
    setSearchTerm(item.alimento);
  }, [item.alimento]);

  const updateCoords = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 320),
      });
    }
  };

  const handleOpenDropdown = () => {
    updateCoords();
    setDropdownOpen(true);
  };

  // Recalculate position on scroll or window resize
  useEffect(() => {
    if (!dropdownOpen) return;

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [dropdownOpen]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current &&
        !inputRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  // Filter foods from Firebase Firestore
  const filteredFoods = searchTerm.trim()
    ? foodsDatabase.filter((f) =>
        f.nome.toLowerCase().includes(searchTerm.toLowerCase().trim())
      )
    : foodsDatabase.slice(0, 45);

  const handleSelectFood = (food: AlimentoRecord) => {
    setSearchTerm(food.nome);
    setDropdownOpen(false);
    onUpdate({
      ...item,
      alimento: food.nome,
      kcal100g: food.kcal100g,
      carbo100g: food.carbo100g,
      prot100g: food.prot100g,
      gord100g: food.gord100g,
      fonte: food.fonte,
    });
  };

  const handleTextChange = (val: string) => {
    setSearchTerm(val);
    updateCoords();
    setDropdownOpen(true);
    // Find exact match if any
    const exact = foodsDatabase.find(
      (f) => f.nome.toLowerCase() === val.toLowerCase().trim()
    );
    if (exact) {
      onUpdate({
        ...item,
        alimento: val,
        kcal100g: exact.kcal100g,
        carbo100g: exact.carbo100g,
        prot100g: exact.prot100g,
        gord100g: exact.gord100g,
        fonte: exact.fonte,
      });
    } else {
      onUpdate({
        ...item,
        alimento: val,
      });
    }
  };

  const parseNumberInput = (val: string): number | '' => {
    if (val === '') return '';
    const clean = val.replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? '' : parsed;
  };

  const gramasNum = typeof item.gramas === 'number' ? item.gramas : 0;
  const kcal100gNum = typeof item.kcal100g === 'number' ? item.kcal100g : 0;
  const calculatedKcal =
    gramasNum > 0 && kcal100gNum > 0
      ? Math.round((gramasNum * kcal100gNum) / 100)
      : 0;

  return (
    <div className="flex items-center gap-3 py-1.5 px-1 min-w-[780px] w-full">
      {/* 1. Alimento input with floating Portal Dropdown */}
      <div className="w-[230px] shrink-0 relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Escolha ou digite..."
          value={searchTerm}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={handleOpenDropdown}
          onClick={handleOpenDropdown}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition"
        />

        {/* Floating Portal Dropdown - completely unclipped and visible */}
        {dropdownOpen &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={dropdownRef}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 99999,
              }}
              className="max-h-72 overflow-y-auto bg-[#132226] border-2 border-teal-500/40 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] py-1.5 text-xs backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            >
              {filteredFoods.length > 0 ? (
                filteredFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => handleSelectFood(food)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#1b333a] flex items-center justify-between gap-2.5 border-b border-[#1b2f34]/80 last:border-none transition group cursor-pointer"
                  >
                    <div className="truncate flex-1">
                      <span className="font-semibold text-slate-100 text-sm block group-hover:text-teal-300">
                        {food.nome}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                        <strong className="text-teal-300 font-semibold">{food.kcal100g} kcal</strong>{' '}
                        • C: {food.carbo100g}g • P: {food.prot100g}g • G: {food.gord100g}g
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        food.fonte === 'taco'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                          : food.fonte === 'usuario'
                          ? 'bg-sky-950 text-sky-300 border border-sky-700/60'
                          : 'bg-teal-950 text-teal-300 border border-teal-700/60'
                      }`}
                    >
                      {food.fonte === 'taco' ? 'TACO' : food.fonte === 'usuario' ? 'Novo' : 'Base'}
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-slate-400 text-center text-xs">
                  Nenhum alimento encontrado com "{searchTerm}".
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenNewFoodModal(searchTerm);
                }}
                className="w-full text-left px-3.5 py-2.5 bg-[#172c32] hover:bg-[#203a42] text-teal-300 font-semibold flex items-center gap-2 border-t border-[#254048] cursor-pointer"
              >
                <Plus className="w-4 h-4 text-teal-400 shrink-0" />
                Cadastrar "{searchTerm || 'novo alimento'}" no Firebase
              </button>
            </div>,
            document.body
          )}
      </div>

      {/* 2. Gramas */}
      <div className="w-[88px] shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={item.gramas}
          onChange={(e) => onUpdate({ ...item, gramas: parseNumberInput(e.target.value) })}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-2 py-2 text-sm text-center text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-400"
        />
      </div>

      {/* 3. kcal/100 g */}
      <div className="w-[88px] shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={item.kcal100g}
          onChange={(e) => onUpdate({ ...item, kcal100g: parseNumberInput(e.target.value) })}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-2 py-2 text-sm text-center text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400"
        />
      </div>

      {/* 4. Carbo/100 g */}
      <div className="w-[88px] shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={item.carbo100g}
          onChange={(e) => onUpdate({ ...item, carbo100g: parseNumberInput(e.target.value) })}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-2 py-2 text-sm text-center text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400"
        />
      </div>

      {/* 5. Prot/100 g */}
      <div className="w-[88px] shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={item.prot100g}
          onChange={(e) => onUpdate({ ...item, prot100g: parseNumberInput(e.target.value) })}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-2 py-2 text-sm text-center text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400"
        />
      </div>

      {/* 6. Gord/100 g */}
      <div className="w-[88px] shrink-0">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={item.gord100g}
          onChange={(e) => onUpdate({ ...item, gord100g: parseNumberInput(e.target.value) })}
          className="w-full bg-[#132428] border border-[#233a41] rounded-xl px-2 py-2 text-sm text-center text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-400"
        />
      </div>

      {/* 7. Total Kcal da Linha */}
      <div className="w-[68px] shrink-0 text-right pr-1">
        <span className="text-base font-bold text-slate-100 font-mono">
          {calculatedKcal}
        </span>
      </div>

      {/* 8. Botão Remover */}
      <div className="w-[36px] shrink-0 text-center">
        <button
          type="button"
          onClick={onRemove}
          title="Remover alimento"
          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition cursor-pointer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
