// Backend

import defaults from './defaults.js';
import BackendError from './BackendError.js';
import {timeout} from './Util.js';

let instance;

export default class Backend {
  #ticket;
  user;
  expires;
  base;

  constructor (base = defaults.base) {
    if (instance) return instance;

    this.base = base;
    instance = this;
  }

  #handleTicket (result) {
    this.#ticket = result.id;
    this.user = result.user_uri;
    this.expires = Math.floor((result.end_time - 621355968000000000) / 10000);
  }

  async authenticate (login, password, secret) {
    const params = {
      method: 'POST',
      url: '/authenticate',
      data: {login, password, secret},
    };
    return this.#call_server(params).then(this.#handleTicket.bind(this));
  }

  async get_ticket_trusted (login) {
    const params = {
      method: 'GET',
      url: '/get_ticket_trusted',
      ticket: this.#ticket,
      data: {login},
    };
    console.log(params);
    return this.#call_server(params).then(this.#handleTicket.bind(this));
  }

  async is_ticket_valid () {
    const params = {
      method: 'GET',
      url: '/is_ticket_valid',
      ticket: this.#ticket,
    };
    return this.#call_server(params);
  }

  async logout () {
    const params = {
      method: 'GET',
      url: '/logout',
      ticket: this.#ticket,
    };
    return this.#call_server(params);
  }

  async get_rights (uri, user_id) {
    const params = {
      method: 'GET',
      url: '/get_rights',
      ticket: this.#ticket,
      data: {uri, user_id},
    };
    return this.#call_server(params);
  }

  async get_rights_origin (uri) {
    const params = {
      method: 'GET',
      url: '/get_rights_origin',
      ticket: this.#ticket,
      data: {uri},
    };
    return this.#call_server(params);
  }

  async get_membership (uri) {
    const params = {
      method: 'GET',
      url: '/get_membership',
      ticket: this.#ticket,
      data: {uri},
    };
    return this.#call_server(params);
  }

  async get_operation_state (module_id, wait_op_id) {
    const params = {
      method: 'GET',
      url: '/get_operation_state',
      data: {module_id, wait_op_id},
    };
    return this.#call_server(params);
  }

  async wait_module (module_id, op_id, __maxCalls = 10) {
    if (!__maxCalls) return false;
    await timeout(250 * (10 - __maxCalls));
    const module_op_id = await this.get_operation_state(module_id, op_id);
    if (module_op_id < op_id) {
      return this.wait_module(module_id, op_id, --__maxCalls);
    }
    return true;
  }

  async query (queryStr, sort, databases, top, limit, from, sql, tries = 10) {
    if (!tries) throw new BackendError(429);
    const arg = queryStr;
    const isObj = typeof arg === 'object';
    const params = {
      method: 'POST',
      url: '/query',
      ticket: this.#ticket,
      data: isObj ? {...queryStr} : {queryStr, sort, databases, top, limit, from, sql},
    };
    return this.#call_server(params).catch(async (backendError) => {
      if (backendError.code === 999) {
        await timeout(1000);
        return this.query(queryStr, sort, databases, top, limit, from, sql, --tries);
      }
      throw backendError;
    });
  }

  async get_individual (uri, cache = true) {
    const params = {
      method: 'GET',
      url: '/get_individual',
      ticket: this.#ticket,
      data: {uri, ...(!cache && {'vsn': Date.now()})},
    };
    return this.#call_server(params);
  }

  async get_individuals (uris) {
    const params = {
      method: 'POST',
      url: '/get_individuals',
      ticket: this.#ticket,
      data: {uris},
    };
    return this.#call_server(params);
  }

  async remove_individual (uri) {
    const params = {
      method: 'PUT',
      url: '/remove_individual',
      ticket: this.#ticket,
      data: {uri},
    };
    return this.#call_server(params);
  }

  async put_individual (individual) {
    const params = {
      method: 'PUT',
      url: '/put_individual',
      ticket: this.#ticket,
      data: {individual},
    };
    return this.#call_server(params);
  }

  async add_to_individual (individual) {
    const params = {
      method: 'PUT',
      url: '/add_to_individual',
      ticket: this.#ticket,
      data: {individual},
    };
    return this.#call_server(params);
  }

  async set_in_individual (individual) {
    const params = {
      method: 'PUT',
      url: '/set_in_individual',
      ticket: this.#ticket,
      data: {individual},
    };
    return this.#call_server(params);
  }

  async remove_from_individual (individual) {
    const params = {
      method: 'PUT',
      url: '/remove_from_individual',
      ticket: this.#ticket,
      data: {individual},
    };
    return this.#call_server(params);
  }

  async put_individuals (individuals) {
    const params = {
      method: 'PUT',
      url: '/put_individuals',
      ticket: this.#ticket,
      data: {individuals},
    };
    return this.#call_server(params);
  }

  /**
   * Common server call function
   * @param {Object} params
   * @return {Promise<Object>}
   */
  async #call_server (params) {
    const url = new URL(params.url, this.base);
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
    const response = await fetch(url, {
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
    if (response.ok) {
      return response.json();
    }
    throw new BackendError(response.status);
  }
}