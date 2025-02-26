import BackendError from './BackendError.js';
import {timeout} from './Util.js';

const storage = typeof localStorage !== 'undefined' ? localStorage : {};

export default class Backend {
  static #ticket;
  static user_uri;
  static expires;
  static base = typeof location !== 'undefined' ? location.origin : 'http://localhost:8080';

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
    return Backend.#call_server(params).then(Backend.#removeTicket);
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

  static async wait_module (module_id, op_id, __maxCalls = 10) {
    if (!__maxCalls) return false;
    await timeout(250 * (10 - __maxCalls));
    const module_op_id = await Backend.get_operation_state(module_id, op_id);
    if (module_op_id < op_id) {
      return Backend.wait_module(module_id, op_id, --__maxCalls);
    }
    return true;
  }

  static query (queryStr, sort, databases, top, limit, from, sql, tries = 10) {
    if (!tries) throw new BackendError(429);
    const arg = queryStr;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: 'query',
      ticket: Backend.#ticket,
      data: isObj ? {...queryStr} : {query: queryStr, sort, databases, top, limit, from, sql},
    };
    return Backend.#call_server(params).catch(async (backendError) => {
      if (backendError.code === 999) {
        await timeout(1000);
        return Backend.query(queryStr, sort, databases, top, limit, from, sql, --tries);
      }
      throw backendError;
    });
  }

  static stored_query (data) {
    const params = {
      method: 'POST',
      url: 'stored_query',
      ticket: Backend.#ticket,
      data,
    };
    return Backend.#call_server(params);
  }

  static get_individual (uri, cache = true) {
    const params = {
      method: 'GET',
      url: 'get_individual',
      ticket: Backend.#ticket,
      data: {uri, ...(!cache && {'vsn': Date.now()})},
    };
    return Backend.#call_server(params);
  }

  static get_individuals (uris) {
    const params = {
      method: 'POST',
      url: 'get_individuals',
      ticket: Backend.#ticket,
      data: {uris},
    };
    return Backend.#call_server(params);
  }

  static async remove_individual (uri) {
    const params = {
      method: 'PUT',
      url: 'remove_individual',
      ticket: Backend.#ticket,
      data: {uri},
    };
    return Backend.#call_server(params);
  }

  static put_individual (individual) {
    const params = {
      method: 'PUT',
      url: 'put_individual',
      ticket: Backend.#ticket,
      data: {individual},
    };
    return Backend.#call_server(params);
  }

  static add_to_individual (individual) {
    const params = {
      method: 'PUT',
      url: 'add_to_individual',
      ticket: Backend.#ticket,
      data: {individual},
    };
    return Backend.#call_server(params);
  }

  static set_in_individual (individual) {
    const params = {
      method: 'PUT',
      url: 'set_in_individual',
      ticket: Backend.#ticket,
      data: {individual},
    };
    return Backend.#call_server(params);
  }

  static remove_from_individual (individual) {
    const params = {
      method: 'PUT',
      url: 'remove_from_individual',
      ticket: Backend.#ticket,
      data: {individual},
    };
    return Backend.#call_server(params);
  }

  static put_individuals (individuals) {
    const params = {
      method: 'PUT',
      url: 'put_individuals',
      ticket: Backend.#ticket,
      data: {individuals},
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
    let response;
    try {
      response = await fetch(url, {
        method: params.method,
        mode: 'same-origin',
        cache: 'no-cache',
        credentials: 'same-origin',
        ...(params.method !== 'GET' && {
          headers: {
            'Content-Type': 'application/json',
          },
          ...(params.data && {body: JSON.stringify(params.data)}),
        }),
      });
    } catch (error) {
      throw new BackendError(0);
    }
    if (!response.ok) throw new BackendError(response.status, response);
    return response.json();
  }

  static async uploadFile ({path, uri, file}) {
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
    };
    const response = await fetch(url, params);
    if (!response.ok) throw new BackendError(response.status, response);
  }
}
