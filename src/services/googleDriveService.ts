import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { auth } from '../firebase/config';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

// In-memory token cache (DO NOT put in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize Google Auth Provider with Workspace scopes
const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => provider.addScope(scope));

export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token;
}

export function cleanSpreadsheetId(idOrUrl: string): string {
  if (!idOrUrl) return '';
  const trimmed = idOrUrl.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed.split('/')[0].split('?')[0].split('#')[0];
}

export function initWorkspaceAuth(
  onSuccess: (user: User, token: string | null) => void,
  onSignedOut: () => void
) {
  return onAuthStateChanged(auth, async (user) => {
    if (user && !user.isAnonymous) {
      onSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      onSignedOut();
    }
  });
}

export async function getOrRefreshToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }
  const result = await signInWithGoogleWorkspace();
  if (!result?.accessToken) {
    throw new Error('Não foi possível obter permissão de acesso ao Google Drive.');
  }
  return result.accessToken;
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string;
} | null> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google Workspace.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Google Workspace Sign-in Error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function signOutGoogleWorkspace() {
  cachedAccessToken = null;
  await signOut(auth);
}

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

// List user spreadsheets from Google Drive
export async function listUserSpreadsheets(
  accessToken: string
): Promise<DriveSpreadsheetFile[]> {
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime)&pageSize=30&orderBy=modifiedTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401) {
      cachedAccessToken = null;
      throw new Error('Sessão expirada. Por favor, reconecte sua conta do Google Drive.');
    }
    throw new Error(
      errorData.error?.message ||
        `Erro ao listar planilhas do Google Drive (${res.status})`
    );
  }

  const data = await res.json();
  return data.files || [];
}

// Get spreadsheet metadata to fetch sheet tabs
export async function getSpreadsheetDetails(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; sheetNames: string[] }> {
  const cleanId = cleanSpreadsheetId(spreadsheetId);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties.title`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error('Planilha não encontrada. Verifique o link ou ID da planilha.');
    }
    if (res.status === 403) {
      throw new Error('Acesso negado à planilha. Verifique se a sua conta tem permissão de editor.');
    }
    throw new Error(
      errData.error?.message ||
        `Erro ao obter detalhes da planilha (${res.status})`
    );
  }

  const data = await res.json();
  const sheetNames = (data.sheets || []).map(
    (s: { properties: { title: string } }) => s.properties.title
  );
  return {
    title: data.properties?.title || 'Planilha',
    sheetNames: sheetNames.length > 0 ? sheetNames : ['Página1'],
  };
}

// Append a row strictly into columns A:F with automatic tab resolution, token refresh, and range formatting
export async function appendRowToGoogleSheet(params: {
  spreadsheetId: string;
  sheetName?: string;
  rowValues: (string | number)[];
  accessToken?: string | null;
}): Promise<{ updatedRange?: string }> {
  const { spreadsheetId, sheetName, rowValues } = params;
  let currentToken = params.accessToken || cachedAccessToken;

  if (!currentToken) {
    currentToken = await getOrRefreshToken();
  }

  const cleanId = cleanSpreadsheetId(spreadsheetId);
  if (!cleanId) {
    throw new Error('ID ou link da planilha inválido.');
  }

  // Ensure row has exactly 6 elements for columns A:F
  const trimmedValues = rowValues.slice(0, 6);
  while (trimmedValues.length < 6) {
    trimmedValues.push('');
  }

  // Helper to fetch details with token refresh retry
  let details: { title: string; sheetNames: string[] };
  try {
    details = await getSpreadsheetDetails(cleanId, currentToken);
  } catch (err: any) {
    if (err?.message?.includes('401') || err?.message?.includes('Sessão expirada')) {
      currentToken = await getOrRefreshToken();
      details = await getSpreadsheetDetails(cleanId, currentToken);
    } else {
      throw err;
    }
  }

  // Resolve best matching sheet tab name from actual spreadsheet tabs
  const availableTabs = details.sheetNames && details.sheetNames.length > 0 ? details.sheetNames : ['Página1'];
  let resolvedTab = availableTabs[0];

  if (sheetName) {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').trim();
    const targetNorm = normalize(sheetName);
    const matched = availableTabs.find((t) => normalize(t) === targetNorm);
    if (matched) {
      resolvedTab = matched;
    }
  }

  // Try appending with different range notation fallbacks if needed
  const rangeCandidates = [
    // 1. Quoted sheet tab with column range A:F (Standard A1 notation)
    `'${resolvedTab.replace(/'/g, "''")}'!A:F`,
    // 2. Unquoted sheet tab if no spaces
    `${resolvedTab}!A:F`,
    // 3. Quoted sheet tab with starting row 1
    `'${resolvedTab.replace(/'/g, "''")}'!A1:F1`,
    // 4. Default column range A:F
    'A:F',
  ];

  let lastError: Error | null = null;

  for (const range of rangeCandidates) {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(
        range
      )}:append?valueInputOption=USER_ENTERED`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range,
          majorDimension: 'ROWS',
          values: [trimmedValues],
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        return { updatedRange: data.updates?.updatedRange };
      }

      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || '';

      if (res.status === 401) {
        // Refresh token and retry this range once
        currentToken = await getOrRefreshToken();
        const retryRes = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range,
            majorDimension: 'ROWS',
            values: [trimmedValues],
          }),
        });
        if (retryRes.ok) {
          const data = await retryRes.json().catch(() => ({}));
          return { updatedRange: data.updates?.updatedRange };
        }
      }

      if (res.status === 404) {
        throw new Error('Planilha não encontrada no Google Drive. Verifique se o link ou ID configurado está correto.');
      }
      if (res.status === 403) {
        throw new Error('Sem permissão para editar esta planilha. Certifique-se de que a sua conta Google conectada possui permissão de Editor na planilha.');
      }

      lastError = new Error(errMsg || `Erro ao gravar na planilha do Google (${res.status}).`);
    } catch (err: any) {
      if (err.message && (err.message.includes('não encontrada') || err.message.includes('permissão'))) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('Não foi possível inserir os dados na planilha.');
}
