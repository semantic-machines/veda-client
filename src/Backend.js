import BackendError from './BackendError.js';
import {timeout} from './Util.js';

/* c8 ignore next - Browser/Node.js environment check */
const storage = typeof localStorage !== 'undefined' ? localStorage : {};

/**
 * Static class for backend communication.
 * Handles authentication, data retrieval, and manipulation.
 */
export default class Backend {
  static #ticket;
  static user_uri;
  static expires;
  /* c8 ignore next - Browser/Node.js environment check */
  static base = typeof location !== 'undefined' ? location.origin : 'http://localhost:8080';

  static errorListeners = new Set();

  /**
   * Register a global error listener for backend errors.
   * @param {Function} listener - Callback function receiving the error object
   * @returns {Function} Unsubscribe function
   */
  static onError(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  /**
   * Emit an error to all registered listeners.
   * @param {Error} error - The error to emit
   */
  static emitError(error) {
    this.errorListeners.forEach(fn => fn(error));
  }

  /**
   * Initialize the backend configuration.
   * @param {string} base - Base URL of the backend server (default: current origin or localhost:8080)
   */
  static init (base = this.base) {
    const {ticket, user_uri, expires} = storage;
    Backend.#ticket = ticket;
    Backend.user_uri = user_uri;
    Backend.expires = expires;
    Backend.base = base;
  }

  static #handleTicket (result) {
    Backend.#ticket = storage.ticket = result.id;
    Backend.user_uri = storage.user_uri = result.user_uri;
    Backend.expires = storage.expires = Math.floor((result.end_time - 621355968000000000) / 10000);
    return {
      user_uri: Backend.user_uri,
      ticket: Backend.#ticket,
      expires: Backend.expires,
    };
  }

  static #removeTicket () {
    Backend.#ticket = undefined;
    delete Backend.user_uri;
    delete Backend.expires;

    delete storage.ticket;
    delete storage.user_uri;
    delete storage.expires;
  }

  /**
   * Authenticate user.
   * @param {string} login - User login
   * @param {string} password - User password
   * @param {string} [secret] - Optional secret
   * @returns {Promise<{user_uri: string, ticket: string, expires: number}>} Auth result
   */
  static authenticate (login, password, secret) {
    const params = {
      method: 'POST',
      url: 'authenticate',
      data: {login, password, secret},
    };
    return Backend.#call_server(params).then(Backend.#handleTicket);
  }

  /**
   * Get trusted ticket for a user (requires admin privileges).
   * @param {string} login - User login
   * @returns {Promise<{user_uri: string, ticket: string, expires: number}>} Auth result
   */
  static get_ticket_trusted (login) {
    const params = {
      method: 'GET',
      url: 'get_ticket_trusted',
      ticket: Backend.#ticket,
      data: {login},
    };
    return Backend.#call_server(params).then(Backend.#handleTicket);
  }

  /**
   * Check if the current or provided ticket is valid.
   * @param {string} [ticket] - Ticket to check (defaults to current ticket)
   * @returns {Promise<boolean>} True if valid
   */
  static is_ticket_valid (ticket = Backend.#ticket) {
    const params = {
      method: 'GET',
      url: 'is_ticket_valid',
      ticket,
    };
    return Backend.#call_server(params);
  }

  /**
   * Logout the current user and invalidate ticket.
   * @returns {Promise<void>}
   */
  static logout () {
    const params = {
      method: 'GET',
      url: 'logout',
      ticket: Backend.#ticket,
    };
    return Backend.#call_server(params).then((result) => {
      Backend.#removeTicket();
      return result;
    });
  }

  /**
   * Get access rights for a resource.
   * @param {string} uri - Resource URI
   * @param {string} [user_id] - User URI (optional, defaults to current user)
   * @returns {Promise<Object>} Rights object
   */
  static get_rights (uri, user_id) {
    const params = {
      method: 'GET',
      url: 'get_rights',
      ticket: Backend.#ticket,
      data: {uri, user_id},
    };
    return Backend.#call_server(params);
  }

  /**
   * Get origin of rights for a resource (why user has rights).
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Rights origin info
   */
  static get_rights_origin (uri) {
    const params = {
      method: 'GET',
      url: 'get_rights_origin',
      ticket: Backend.#ticket,
      data: {uri},
    };
    return Backend.#call_server(params);
  }

  /**
   * Get membership information for a resource (groups/orgs it belongs to).
   * @param {string} uri - Resource URI
   * @returns {Promise<Object>} Membership info
   */
  static get_membership (uri) {
    const params = {
      method: 'GET',
      url: 'get_membership',
      ticket: Backend.#ticket,
      data: {uri},
    };
    return Backend.#call_server(params);
  }

  /**
   * Get state of an async operation in a module.
   * @param {string} module_id - Module identifier
   * @param {number} wait_op_id - Operation ID to wait for
   * @returns {Promise<number>} Current operation ID
   */
  static get_operation_state (module_id, wait_op_id) {
    const params = {
      method: 'GET',
      url: 'get_operation_state',
      data: {module_id, wait_op_id},
    };
    return Backend.#call_server(params);
  }

  /**
   * Wait for a specific operation to complete in a module.
   * @param {string} module_id - Module identifier
   * @param {number} op_id - Operation ID
   * @param {number} [__maxCalls=10] - Internal recursion limit
   * @returns {Promise<boolean>} True if operation completed
   */
  static wait_module (module_id, op_id, __maxCalls = 10) {
    if (!__maxCalls) return Promise.resolve(false);
    return timeout(250 * (10 - __maxCalls)).then(() =>
      Backend.get_operation_state(module_id, op_id).then((module_op_id) => {
        if (module_op_id < op_id) {
          return Backend.wait_module(module_id, op_id, --__maxCalls);
        }
        return true;
      })
    );
  }

  /**
   * Execute a search query.
   * @param {string|Object} queryStr - VQL query string or params object
   * @param {string} [sort] - Sort expression (e.g. "'v-s:created' desc")
   * @param {string[]} [databases] - Databases to search in
   * @param {number} [top] - Number of results to return
   * @param {number} [limit] - Limit results
   * @param {number} [from] - Offset
   * @param {string} [sql] - SQL query (advanced)
   * @param {AbortSignal} [signal] - Abort signal
   * @param {number} [tries=10] - Retry attempts for busy server
   * @returns {Promise<{result: string[], count: number, estimated: number}>} Query results
   */
  static query (queryStr, sort, databases, top, limit, from, sql, signal, tries = 10) {
    if (!tries) return Promise.reject(new BackendError(429));
    const arg = queryStr;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: 'query',
      ticket: Backend.#ticket,
      data: isObj ? {...queryStr} : {query: queryStr, sort, databases, top, limit, from, sql},
      signal,
    };
    return Backend.#call_server(params).catch(async (backendError) => {
      if (backendError.code === 999 && tries > 1) {
        await timeout(1000);
        return Backend.query(queryStr, sort, databases, top, limit, from, sql, signal, --tries);
      }
      throw backendError;
    });
  }

  /**
   * Execute a stored query.
   * @param {Object} data - Stored query parameters
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Query results
   */
  static stored_query (data, signal) {
    const params = {
      method: 'POST',
      url: 'stored_query',
      ticket: Backend.#ticket,
      data,
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Get individual resource by URI.
   * @param {string} uri - Resource URI
   * @param {boolean} [cache=true] - Allow server-side caching
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} JSON resource data
   */
  static get_individual (uri, cache = true, signal = undefined) {
    const params = {
      method: 'GET',
      url: 'get_individual',
      ticket: Backend.#ticket,
      data: {uri, ...(!cache && {'vsn': Date.now()})},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Get multiple individuals by URIs.
   * @param {string[]} uris - Array of resource URIs
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object[]>} Array of JSON resource data
   */
  static get_individuals (uris, signal) {
    const params = {
      method: 'POST',
      url: 'get_individuals',
      ticket: Backend.#ticket,
      data: {uris},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Remove an individual.
   * @param {string} uri - Resource URI to remove
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static remove_individual (uri, signal) {
    const params = {
      method: 'PUT',
      url: 'remove_individual',
      ticket: Backend.#ticket,
      data: {uri},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Create or update an individual (full replace).
   * @param {Object} individual - JSON object
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static put_individual (individual, signal) {
    const params = {
      method: 'PUT',
      url: 'put_individual',
      ticket: Backend.#ticket,
      data: {individual},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Add values to an existing individual (append).
   * Useful for concurrent updates to avoid race conditions.
   * @param {Object} individual - Partial JSON object with values to add
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static add_to_individual (individual, signal) {
    const params = {
      method: 'PUT',
      url: 'add_to_individual',
      ticket: Backend.#ticket,
      data: {individual},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Set specific values in an existing individual (replace specific properties).
   * Useful for concurrent updates.
   * @param {Object} individual - Partial JSON object with values to set
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static set_in_individual (individual, signal) {
    const params = {
      method: 'PUT',
      url: 'set_in_individual',
      ticket: Backend.#ticket,
      data: {individual},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Remove specific values from an existing individual.
   * Useful for concurrent updates.
   * @param {Object} individual - Partial JSON object with values to remove
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static remove_from_individual (individual, signal) {
    const params = {
      method: 'PUT',
      url: 'remove_from_individual',
      ticket: Backend.#ticket,
      data: {individual},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Create or update multiple individuals (batch).
   * @param {Object[]} individuals - Array of JSON resource data
   * @param {AbortSignal} [signal] - Abort signal
   * @returns {Promise<Object>} Operation result
   */
  static put_individuals (individuals, signal) {
    const params = {
      method: 'PUT',
      url: 'put_individuals',
      ticket: Backend.#ticket,
      data: {individuals},
      signal,
    };
    return Backend.#call_server(params);
  }

  /**
   * Common server call function
   * @param {Object} params
   * @return {Promise<Object>}
   */
  static async #call_server (params) {
    const url = new URL(params.url, Backend.base);
    if (params.method === 'GET' && params.data) {
      for (const prop in params.data) {
        if (typeof params.data[prop] === 'undefined') {
          delete params.data[prop];
        }
      }
      url.search = new URLSearchParams(params.data).toString();
    }
    if (params.ticket) {
      url.searchParams.append('ticket', params.ticket);
    }
    const fetchOptions = {
      method: params.method,
      headers: { 'Content-Type': 'application/json' },
      body: params.method !== 'GET' ? JSON.stringify(params.data) : undefined,
      signal: params.signal,
    };
    let response;
    try {
      response = await fetch(url, fetchOptions);
      if (!response.ok) throw new BackendError(response.status);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // Пробрасываем AbortError дальше без оборачивания в BackendError
      }
      // Оборачиваем любые другие ошибки в BackendError
      if (!(error instanceof BackendError)) {
        const backendError = new BackendError(0, error);
        Backend.emitError(backendError);
        throw backendError;
      }
      Backend.emitError(error);
      throw error;
    }
  }

  /**
   * Upload a file to the server.
   * @param {Object} params
   * @param {string} params.path - Target path
   * @param {string} params.uri - Resource URI
   * @param {File|string} params.file - File object or base64 string
   * @param {AbortSignal} [params.signal] - Abort signal
   * @returns {Promise<void>}
   */
  static async uploadFile ({path, uri, file, signal}) {
    const form = new FormData();
    form.append('path', path);
    form.append('uri', uri);
    if (typeof file === 'string') {
      const content = file.startsWith('data:text/plain;base64') ? file : `data:text/plain;base64,${file}`;
      form.append('content', content);
    } else {
      form.append('file', file);
    }

    const url = new URL('files', Backend.base);
    url.searchParams.append('ticket', Backend.#ticket);

    const params = {
      method: 'POST',
      mode: 'same-origin',
      cache: 'no-cache',
      credentials: 'same-origin',
      body: form,
      signal,
    };
    try {
      const response = await fetch(url, params);
      if (!response.ok) throw new BackendError(response.status, response);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error;
      }
      if (!(error instanceof BackendError)) {
        const backendError = new BackendError(0, error);
        Backend.emitError(backendError);
        throw backendError;
      }
      Backend.emitError(error);
      throw error;
    }
  }
}
