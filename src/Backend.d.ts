import BackendError from './BackendError.js';
import { ValueData } from './Value.js';

export interface IndividualData {
  '@': string;
  [property: string]: ValueData | ValueData[] | string;
}

export interface AuthResult {
  user_uri: string;
  expires: number;
}

export interface QueryResult {
  result: string[];
  count?: number;
  estimated?: number;
  processed?: number;
  cursor?: number;
}

export interface QueryParams {
  query: string;
  sort?: string;
  databases?: string;
  top?: number;
  limit?: number;
  from?: number;
  sql?: boolean;
}

export interface UploadFileParams {
  path: string;
  uri: string;
  file: File | Blob | string;
  signal?: AbortSignal;
}

export default class Backend {
  static user_uri: string;
  static expires: number;
  static base: string;

  static errorListeners: Set<(error: BackendError) => void>;

  static onError(listener: (error: BackendError) => void): () => void;
  static emitError(error: BackendError): void;

  static init(base?: string): void;

  static authenticate(login: string, password: string, secret?: string): Promise<AuthResult>;
  static get_ticket_trusted(login: string): Promise<AuthResult>;
  static is_ticket_valid(): Promise<any>;
  static logout(): Promise<any>;

  static get_rights(uri: string, user_id?: string): Promise<IndividualData>;
  static get_rights_origin(uri: string): Promise<IndividualData>;
  static get_membership(uri: string): Promise<IndividualData>;

  static get_operation_state(module_id: string, wait_op_id: number): Promise<number>;
  static wait_module(module_id: string, op_id: number, maxCalls?: number): Promise<boolean>;

  static query(
    queryStr: string | QueryParams,
    sort?: string,
    databases?: string,
    top?: number,
    limit?: number,
    from?: number,
    sql?: boolean,
    tries?: number,
    signal?: AbortSignal
  ): Promise<QueryResult>;

  static stored_query(data: any, signal?: AbortSignal): Promise<QueryResult>;

  static get_individual(uri: string, cache?: boolean, signal?: AbortSignal): Promise<IndividualData>;
  static get_individuals(uris: string[], signal?: AbortSignal): Promise<IndividualData[]>;

  static put_individual(individual: IndividualData, signal?: AbortSignal): Promise<any>;
  static add_to_individual(individual: IndividualData, signal?: AbortSignal): Promise<any>;
  static set_in_individual(individual: IndividualData, signal?: AbortSignal): Promise<any>;
  static remove_from_individual(individual: IndividualData, signal?: AbortSignal): Promise<any>;
  static remove_individual(uri: string, signal?: AbortSignal): Promise<any>;
  static put_individuals(individuals: IndividualData[], signal?: AbortSignal): Promise<any>;

  static uploadFile(params: UploadFileParams): Promise<void>;
}

