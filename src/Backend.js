import BackendError from './BackendError.js';
import {timeout} from './Util.js';

/* c8 ignore next - Browser/Node.js environment check */
const storage = typeof localStorage !== 'undefined' ? localStorage : {};

export default class Backend {
  static #ticket;
  static user_uri;
  static expires;
  /* c8 ignore next - Browser/Node.js environment check */
  static base = typeof location !== 'undefined' ? location.origin : 'http://localhost:8080';

  static errorListeners = new Set();

  static onError(listener) {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  static emitError(error) {
    this.errorListeners.forEach(fn => fn(error));
  }

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

  static authenticate (login, password, secret) {
    const params = {
      method: 'POST',
      url: 'authenticate',
      data: {login, password, secret},
    };
    return Backend.#call_server(params).then(Backend.#handleTicket);
  }

  static get_ticket_trusted (login) {
    const params = {
      method: 'GET',
      url: 'get_ticket_trusted',
      ticket: Backend.#ticket,
      data: {login},
    };
    return Backend.#call_server(params).then(Backend.#handleTicket);
  }

  static is_ticket_valid (ticket = Backend.#ticket) {
    const params = {
      method: 'GET',
      url: 'is_ticket_valid',
      ticket,
    };
    return Backend.#call_server(params);
  }

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

  static get_rights (uri, user_id) {
    const params = {
      method: 'GET',
      url: 'get_rights',
      ticket: Backend.#ticket,
      data: {uri, user_id},
    };
    return Backend.#call_server(params);
  }

  static get_rights_origin (uri) {
    const params = {
      method: 'GET',
      url: 'get_rights_origin',
      ticket: Backend.#ticket,
      data: {uri},
    };
    return Backend.#call_server(params);
  }

  static get_membership (uri) {
    const params = {
      method: 'GET',
      url: 'get_membership',
      ticket: Backend.#ticket,
      data: {uri},
    };
    return Backend.#call_server(params);
  }

  static get_operation_state (module_id, wait_op_id) {
    const params = {
      method: 'GET',
      url: 'get_operation_state',
      data: {module_id, wait_op_id},
    };
    return Backend.#call_server(params);
  }

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

  static async uploadFile ({path, uri, file, signal}) {
    const form = new FormData();
    form.append('path', path);
    form.append('uri', uri);
    if (typeof file === 'string') {
      /* c8 ignore next - Base64 prefix check */
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
