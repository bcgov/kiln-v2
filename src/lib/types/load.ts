import type { Writable } from 'svelte/store';

// Shared types for data loading and form loader utilities

export type Params = { [key: string]: string | null };

export type LoadDeps = {
  setJsonContent: (data: any) => void;
  navigate: (path: string, opts?: { state?: { message?: string } }) => void;
  getCookie: (name: string) => string | null | undefined;
  keycloak?: { token?: string | null } | null;
};

export type LoadOptions = {
  endpoint: string;
  params?: Params;
  setLoading?: (v: boolean) => void;
  includeAuth?: boolean;
  includeOriginalServer?: boolean;
  expectSaveData?: boolean;
  parseErrorBody?: boolean;
  navigateOnError?: boolean;
  onError?: (message: string) => void;
};

export interface UseFormLoaderOptions {
  apiEndpoint: string | (() => Promise<any>);
  parseSaveData?: boolean;
  expectSaveData?: boolean;
  parseErrorBody?: boolean;
  includeAuth?: boolean;
  includeOriginalServer?: boolean;
  transformParams?: (params: Record<string, string>) => Record<string, any>;
}

export interface UseFormLoaderReturn {
  isLoading: Writable<boolean>;
  error: Writable<string | null>;
  formData: Writable<object>;
  saveData: Writable<object>;
  load: () => Promise<void>;
  disablePrint: Writable<boolean>;
}

export interface UsePDFLoaderReturn {
  isLoading: Writable<boolean>;
  error: Writable<string | null>;  
  load: () => Promise<void>;
  pdfBlob: Writable<Blob | null>
}