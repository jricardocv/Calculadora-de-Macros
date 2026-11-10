import React, { useState, useEffect } from 'react';
import {
  X,
  FileSpreadsheet,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  DriveSpreadsheetFile,
  listUserSpreadsheets,
  getSpreadsheetDetails,
  signInWithGoogleWorkspace,
  signOutGoogleWorkspace,
  cleanSpreadsheetId
} from '../services/googleDriveService';

interface GoogleSheetsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  accessToken: string | null;
  onTokenUpdated: (user: User, token: string) => void;
  selectedSpreadsheetId: string;
  selectedSheetName: string;
  columnFormat: 'data_hora_refeicao' | 'data_refeicao_macros';
  onSaveConfig: (params: {
    spreadsheetId: string;
    spreadsheetTitle: string;
    sheetName: string;
    columnFormat: 'data_hora_refeicao' | 'data_refeicao_macros';
  }) => void;
}

export const GoogleSheetsConfigModal: React.FC<GoogleSheetsConfigModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  accessToken,
  onTokenUpdated,
  selectedSpreadsheetId,
  selectedSheetName,
  columnFormat,
  onSaveConfig,
}) => {
  const [spreadsheets, setSpreadsheets] = useState<DriveSpreadsheetFile[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentSpreadsheetId, setCurrentSpreadsheetId] = useState(selectedSpreadsheetId);
  const [currentSpreadsheetTitle, setCurrentSpreadsheetTitle] = useState('');
  const [sheetTabs, setSheetTabs] = useState<string[]>([]);
  const [currentSheetName, setCurrentSheetName] = useState(selectedSheetName);
  const [currentColumnFormat, setCurrentColumnFormat] = useState(columnFormat);
  const [manualInput, setManualInput] = useState('');

  // Fetch Drive spreadsheets when opened and authenticated
  useEffect(() => {
    if (isOpen && accessToken) {
      loadDriveFiles(accessToken);
    }
  }, [isOpen, accessToken]);

  // Load sheet tabs if spreadsheetId is set
  useEffect(() => {
    if (currentSpreadsheetId && accessToken) {
      loadSpreadsheetTabs(currentSpreadsheetId, accessToken);
    }
  }, [currentSpreadsheetId, accessToken]);

  const loadDriveFiles = async (token: string) => {
    setLoadingDrive(true);
    setError(null);
    try {
      const files = await listUserSpreadsheets(token);
      setSpreadsheets(files);
      if (currentSpreadsheetId) {
        const found = files.find((f) => f.id === currentSpreadsheetId);
        if (found) setCurrentSpreadsheetTitle(found.name);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Erro ao conectar ao Google Drive.'
      );
    } finally {
      setLoadingDrive(false);
    }
  };

  const loadSpreadsheetTabs = async (id: string, token: string) => {
    setLoadingSheets(true);
    try {
      const details = await getSpreadsheetDetails(id, token);
      setCurrentSpreadsheetTitle(details.title);
      setSheetTabs(details.sheetNames);
      if (!currentSheetName || !details.sheetNames.includes(currentSheetName)) {
        setCurrentSheetName(details.sheetNames[0] || 'Página1');
      }
    } catch (err: unknown) {
      console.warn('Erro ao carregar abas:', err);
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      const result = await signInWithGoogleWorkspace();
      if (result) {
        onTokenUpdated(result.user, result.accessToken);
        await loadDriveFiles(result.accessToken);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Falha no login com Google Workspace.'
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSelectSpreadsheet = (id: string, name: string) => {
    const cleanId = cleanSpreadsheetId(id);
    setCurrentSpreadsheetId(cleanId);
    setCurrentSpreadsheetTitle(name);
    if (accessToken) {
      loadSpreadsheetTabs(cleanId, accessToken);
    }
  };

  const handleParseManualLink = () => {
    if (!manualInput.trim()) return;
    const cleanId = cleanSpreadsheetId(manualInput);
    setCurrentSpreadsheetId(cleanId);
    if (accessToken) {
      loadSpreadsheetTabs(cleanId, accessToken);
    }
  };

  const handleSave = () => {
    const cleanId = cleanSpreadsheetId(currentSpreadsheetId);
    if (!cleanId) {
      setError('Por favor, selecione uma planilha do Google Drive ou informe um link válido.');
      return;
    }

    onSaveConfig({
      spreadsheetId: cleanId,
      spreadsheetTitle: currentSpreadsheetTitle || 'Planilha Selecionada',
      sheetName: currentSheetName || 'Página1',
      columnFormat: currentColumnFormat,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#121f23] border border-[#233c44] rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f353c] bg-[#0e191c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-100 text-lg">
                Conectar com Google Drive & Planilhas
              </h2>
              <p className="text-xs text-slate-400">
                Os dados serão salvos diretamente na sua planilha (Colunas A:F).
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

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Auth State */}
          {!accessToken ? (
            <div className="bg-[#16272c] border border-[#253f47] rounded-xl p-5 text-center space-y-4">
              <p className="text-sm text-slate-300">
                Para salvar automaticamente na sua planilha do Google Drive, conecte sua conta Google:
              </p>

              {/* Official Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isSigningIn}
                className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl bg-white text-gray-800 hover:bg-gray-100 font-semibold text-sm shadow-md transition active:scale-98 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isSigningIn ? 'Conectando...' : 'Conectar com Google Drive'}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Connected Account status */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#15252a] border border-[#223b43]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-xs">
                    {currentUser?.email ? currentUser.email[0].toUpperCase() : 'G'}
                  </div>
                  <div>
                    <span className="text-xs text-teal-300 font-medium block">
                      Conectado ao Google Drive
                    </span>
                    <span className="text-xs text-slate-300 font-mono">
                      {currentUser?.email}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={signOutGoogleWorkspace}
                  className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-[#1a2d32] transition"
                >
                  Desconectar
                </button>
              </div>

              {/* Select Spreadsheet from Drive */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Selecione a sua Planilha no Google Drive:
                  </label>
                  <button
                    type="button"
                    onClick={() => accessToken && loadDriveFiles(accessToken)}
                    disabled={loadingDrive}
                    className="flex items-center gap-1 text-[11px] text-teal-400 hover:underline"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingDrive ? 'animate-spin' : ''}`} />
                    Atualizar lista
                  </button>
                </div>

                {spreadsheets.length > 0 ? (
                  <div className="max-h-44 overflow-y-auto bg-[#152529] border border-[#243c44] rounded-xl p-1.5 space-y-1">
                    {spreadsheets.map((file) => {
                      const isSelected = file.id === currentSpreadsheetId;
                      return (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => handleSelectSpreadsheet(file.id, file.name)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : 'text-slate-300 hover:bg-[#1c3035]'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500 bg-[#152529] rounded-xl border border-[#243c44]">
                    {loadingDrive ? 'Carregando suas planilhas do Drive...' : 'Nenhuma planilha encontrada automaticamente. Você pode colar o link abaixo.'}
                  </div>
                )}
              </div>

              {/* Or Paste Link / ID */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Ou cole o link / ID da sua planilha:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs... ou ID"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    className="flex-1 bg-[#152529] border border-[#243c44] rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={handleParseManualLink}
                    className="px-3 py-2 rounded-xl bg-[#1c3036] hover:bg-[#253e46] text-slate-200 text-xs font-medium border border-[#29434c] transition"
                  >
                    Carregar
                  </button>
                </div>
              </div>

              {/* Select Sheet Tab */}
              {currentSpreadsheetId && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Aba da Planilha:
                  </label>
                  {sheetTabs.length > 0 ? (
                    <select
                      value={currentSheetName}
                      onChange={(e) => setCurrentSheetName(e.target.value)}
                      className="w-full bg-[#152529] border border-[#243c44] rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-teal-400"
                    >
                      {sheetTabs.map((tab) => (
                        <option key={tab} value={tab} className="bg-[#121f23]">
                          {tab}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={currentSheetName}
                      onChange={(e) => setCurrentSheetName(e.target.value)}
                      placeholder="Nome da aba (Ex: Página1)"
                      className="w-full bg-[#152529] border border-[#243c44] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-400"
                    />
                  )}
                </div>
              )}

              {/* Column Structure A:F configuration & preview */}
              <div className="bg-[#0f191c] border border-[#1e343b] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">
                      Mapeamento das Colunas A:F
                    </span>
                    <span className="text-[11px] text-teal-400 font-medium">
                      ✓ Apenas a Data (sem hora), Refeição e Todos os 4 Macros
                    </span>
                  </div>
                </div>

                {/* Visual table columns preview A:F */}
                <div className="grid grid-cols-6 gap-1.5 text-center font-mono text-[10px]">
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col A</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Data</span>
                  </div>
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col B</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Refeição</span>
                  </div>
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col C</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Kcal</span>
                  </div>
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col D</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Carbo (g)</span>
                  </div>
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col E</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Prot (g)</span>
                  </div>
                  <div className="bg-[#16272c] p-2 rounded border border-[#233a41]">
                    <span className="text-teal-400 block font-bold">Col F</span>
                    <span className="text-slate-200 mt-1 block font-sans font-medium">Gord (g)</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-normal">
                  ✓ O sistema anexará as refeições estritamente nas colunas <strong>A:F</strong>, sem incluir hora, preservando intactas quaisquer fórmulas e colunas a partir de G.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/50 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-[#1e343b] bg-[#0e191c] flex items-center justify-between">
          {currentSpreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${currentSpreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-teal-400 hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir planilha no Google
            </a>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!accessToken || !currentSpreadsheetId}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-teal-400 hover:bg-teal-300 text-[#0c181b] transition disabled:opacity-40 cursor-pointer"
            >
              Confirmar e Salvar Planilha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
