import React from 'react';
import { X, FileSpreadsheet, Check, AlertTriangle } from 'lucide-react';

interface ConfirmAppendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  spreadsheetTitle: string;
  sheetName: string;
  rowValues: (string | number)[];
  loading: boolean;
  error?: string | null;
}

export const ConfirmAppendModal: React.FC<ConfirmAppendModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  spreadsheetTitle,
  sheetName,
  rowValues,
  loading,
  error,
}) => {
  if (!isOpen) return null;

  const colHeaders = [
    { col: 'A', name: 'Data' },
    { col: 'B', name: 'Refeição' },
    { col: 'C', name: 'Kcal' },
    { col: 'D', name: 'Carbo' },
    { col: 'E', name: 'Prot' },
    { col: 'F', name: 'Gord' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#121f23] border border-[#233c44] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f353c] bg-[#0e191c]">
          <div className="flex items-center gap-2.5 text-teal-400">
            <FileSpreadsheet className="w-5 h-5" />
            <h3 className="font-semibold text-slate-100 text-base">
              Confirmar Gravação na Planilha
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-[#182a2e] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Deseja inserir os dados desta refeição diretamente nas colunas{' '}
            <strong className="text-teal-300 font-semibold">A:F</strong> da planilha{' '}
            <strong className="text-slate-100">"{spreadsheetTitle}"</strong> (aba{' '}
            <span className="font-mono text-teal-300">"{sheetName}"</span>)?
          </p>

          <div className="bg-[#0f191c] border border-[#1e343b] rounded-xl p-3.5 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Dados a serem gravados (Colunas A:F - Apenas Data, sem hora):
            </span>
            <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-xs">
              {rowValues.slice(0, 6).map((val, idx) => (
                <div key={idx} className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                  <span className="text-[10px] text-teal-400 font-bold block mb-0.5">
                    Col {colHeaders[idx]?.col || idx}
                  </span>
                  <span className="text-[10px] text-slate-400 block mb-1">
                    {colHeaders[idx]?.name || ''}
                  </span>
                  <span className="text-slate-100 font-semibold block truncate" title={String(val)}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-start gap-2 bg-[#142327] p-2.5 rounded-lg border border-[#20363d]">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Apenas as colunas A:F serão preenchidas. Fórmulas e colunas a partir de G permanecerão intactas.
            </span>
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-900/60 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#1e343b] bg-[#0e191c] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-400 hover:bg-teal-300 text-[#0c181b] transition shadow-md disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              'Gravando...'
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmar e Gravar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
