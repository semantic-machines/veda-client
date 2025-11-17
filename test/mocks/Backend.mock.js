/**
 * Mock Backend for testing
 * Provides isolated in-memory backend without network calls
 */

export class MockBackend {
  constructor() {
    this.storage = new Map();
    this.rightsStorage = new Map(); // Store rights per individual
    this.membershipStorage = new Map(); // Store memberships per user
    this.authenticated = false;
    this.currentUser = null;
    this.delay = 0; // Simulate network delay (ms)
    
    // Advanced error simulation
    this.errorConfig = {
      enabled: false,
      type: null, // 'timeout', 'network', 'server', 'ratelimit', 'partial'
      probability: 0, // 0-1, random failure rate
      failureCount: 0, // Fail first N requests
      targetMethod: null, // Fail specific method only
    };
    
    this.requestCount = 0;
    this.requestLog = [];
    
    // Rate limiting simulation
    this.rateLimit = {
      enabled: false,
      maxRequests: 100,
      windowMs: 60000,
      requests: []
    };
  }

  async authenticate(login, password) {
    this.#logRequest('authenticate', { login });
    await this.#checkErrors('authenticate');
    await this.#delay();
    this.authenticated = true;
    this.currentUser = login;
    return true;
  }

  async get_individual(id, useCache = true) {
    this.#logRequest('get_individual', { id, useCache });
    await this.#checkErrors('get_individual');
    await this.#delay();
    if (!this.storage.has(id)) {
      throw new Error(`Individual ${id} not found`);
    }
    return this.storage.get(id);
  }

  async put_individual(individual) {
    this.#logRequest('put_individual', { id: individual['@'] });
    await this.#checkErrors('put_individual');
    await this.#delay();
    const id = individual['@'];
    if (!id) {
      throw new Error('Individual must have @ property');
    }
    this.storage.set(id, individual);
    return id;
  }

  async remove_individual(id) {
    this.#logRequest('remove_individual', { id });
    await this.#checkErrors('remove_individual');
    await this.#delay();
    this.storage.delete(id);
    return true;
  }

  async query(ticket, query, sort, databases, reopen, top, limit, from) {
    await this.#delay();
    // Simple mock query - returns all stored individuals
    const results = Array.from(this.storage.values())
      .filter(ind => {
        // Basic query matching
        if (query && query.includes('*')) return true;
        return false;
      })
      .slice(from || 0, (from || 0) + (limit || 10));
    
    return {
      result: results.map(ind => ind['@']),
      count: results.length,
      estimated: results.length,
      processed: results.length,
      cursor: 0
    };
  }

  async get_rights(id, user_uri) {
    await this.#delay();
    
    // Check if specific rights are stored
    const key = `${id}:${user_uri || 'default'}`;
    if (this.rightsStorage.has(key)) {
      return this.rightsStorage.get(key);
    }
    
    // Mock rights - full access by default
    return {
      '@': id + '-rights',
      'v-s:canCreate': [{ data: true, type: 'Boolean' }],
      'v-s:canRead': [{ data: true, type: 'Boolean' }],
      'v-s:canUpdate': [{ data: true, type: 'Boolean' }],
      'v-s:canDelete': [{ data: true, type: 'Boolean' }]
    };
  }

  async get_membership(id) {
    await this.#delay();
    
    // Check if specific memberships are stored
    if (this.membershipStorage.has(id)) {
      return this.membershipStorage.get(id);
    }
    
    // Mock membership - default group
    return {
      '@': id + '-membership',
      'v-s:memberOf': [
        { data: 'v-s:AllResourcesGroup', type: 'Uri' }
      ]
    };
  }

  async is_membership(id, group) {
    await this.#delay();
    const memberships = await this.get_membership(id);
    return memberships.includes(group);
  }

  reset() {
    this.storage.clear();
    this.rightsStorage.clear();
    this.membershipStorage.clear();
    this.authenticated = false;
    this.currentUser = null;
    this.requestCount = 0;
    this.requestLog = [];
    this.errorConfig = {
      enabled: false,
      type: null,
      probability: 0,
      failureCount: 0,
      targetMethod: null,
    };
    this.rateLimit.requests = [];
  }

  // Seed test data
  seed(data) {
    Object.entries(data).forEach(([id, individual]) => {
      this.storage.set(id, { '@': id, ...individual });
    });
  }

  // Seed rights for specific individual/user combination
  seedRights(individualId, userUri, rights) {
    const key = `${individualId}:${userUri || 'default'}`;
    this.rightsStorage.set(key, {
      '@': `${individualId}-rights`,
      ...rights
    });
  }

  // Seed memberships for specific user
  seedMembership(userId, membership) {
    this.membershipStorage.set(userId, {
      '@': `${userId}-membership`,
      ...membership
    });
  }

  // ==================== ADVANCED ERROR SIMULATION ====================

  /**
   * Configure error simulation
   * @param {Object} config - Error configuration
   */
  configureErrors(config) {
    Object.assign(this.errorConfig, config);
  }

  /**
   * Simulate timeout error
   */
  simulateTimeout(method = null) {
    this.errorConfig = {
      enabled: true,
      type: 'timeout',
      targetMethod: method,
      probability: 1.0
    };
  }

  /**
   * Simulate network error
   */
  simulateNetworkError(method = null, probability = 1.0) {
    this.errorConfig = {
      enabled: true,
      type: 'network',
      targetMethod: method,
      probability
    };
  }

  /**
   * Simulate server error (500)
   */
  simulateServerError(method = null) {
    this.errorConfig = {
      enabled: true,
      type: 'server',
      targetMethod: method,
      probability: 1.0
    };
  }

  /**
   * Simulate rate limiting
   */
  simulateRateLimit() {
    this.errorConfig = {
      enabled: true,
      type: 'ratelimit',
      probability: 1.0
    };
  }

  /**
   * Simulate partial/corrupted response
   */
  simulatePartialResponse(method = null) {
    this.errorConfig = {
      enabled: true,
      type: 'partial',
      targetMethod: method,
      probability: 1.0
    };
  }

  /**
   * Simulate intermittent failures (random)
   */
  simulateIntermittentFailures(probability = 0.3, method = null) {
    this.errorConfig = {
      enabled: true,
      type: 'network',
      targetMethod: method,
      probability
    };
  }

  /**
   * Fail first N requests
   */
  failFirstRequests(count, method = null) {
    this.errorConfig = {
      enabled: true,
      type: 'network',
      targetMethod: method,
      failureCount: count
    };
  }

  /**
   * Clear error configuration
   */
  clearErrors() {
    this.errorConfig.enabled = false;
  }

  /**
   * Enable rate limiting
   */
  enableRateLimit(maxRequests = 100, windowMs = 60000) {
    this.rateLimit.enabled = true;
    this.rateLimit.maxRequests = maxRequests;
    this.rateLimit.windowMs = windowMs;
  }

  /**
   * Get request log
   */
  getRequestLog() {
    return [...this.requestLog];
  }

  /**
   * Get request count by method
   */
  getRequestCount(method = null) {
    if (!method) return this.requestCount;
    return this.requestLog.filter(r => r.method === method).length;
  }

  // ==================== PRIVATE METHODS ====================

  async #delay() {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
  }

  #logRequest(method, args) {
    this.requestCount++;
    this.requestLog.push({
      method,
      args,
      timestamp: Date.now(),
      requestNumber: this.requestCount
    });
  }

  async #checkErrors(method) {
    if (!this.errorConfig.enabled) return;

    // Check if this method is targeted
    if (this.errorConfig.targetMethod && this.errorConfig.targetMethod !== method) {
      return;
    }

    // Check failure count
    if (this.errorConfig.failureCount > 0) {
      this.errorConfig.failureCount--;
      await this.#throwError(this.errorConfig.type);
      return;
    }

    // Check probability
    if (Math.random() < this.errorConfig.probability) {
      await this.#throwError(this.errorConfig.type);
    }

    // Check rate limit
    if (this.rateLimit.enabled) {
      await this.#checkRateLimit();
    }
  }

  async #throwError(type) {
    switch (type) {
      case 'timeout':
        await new Promise(resolve => setTimeout(resolve, 30000)); // Simulate timeout
        throw new Error('Request timeout');
      
      case 'network':
        throw new Error('Network error: Failed to fetch');
      
      case 'server':
        const error = new Error('Internal Server Error');
        error.status = 500;
        throw error;
      
      case 'ratelimit':
        const rateLimitError = new Error('Too Many Requests');
        rateLimitError.status = 429;
        rateLimitError.retryAfter = 60;
        throw rateLimitError;
      
      case 'partial':
        // Return incomplete/corrupted data
        throw new Error('Partial response received');
      
      default:
        throw new Error('Unknown error');
    }
  }

  async #checkRateLimit() {
    const now = Date.now();
    const windowStart = now - this.rateLimit.windowMs;

    // Clean old requests
    this.rateLimit.requests = this.rateLimit.requests.filter(
      time => time > windowStart
    );

    // Check limit
    if (this.rateLimit.requests.length >= this.rateLimit.maxRequests) {
      const error = new Error('Rate limit exceeded');
      error.status = 429;
      error.retryAfter = Math.ceil(
        (this.rateLimit.requests[0] + this.rateLimit.windowMs - now) / 1000
      );
      throw error;
    }

    // Log request
    this.rateLimit.requests.push(now);
  }
}

// Singleton instance
let mockBackendInstance = null;

export function getMockBackend() {
  if (!mockBackendInstance) {
    mockBackendInstance = new MockBackend();
  }
  return mockBackendInstance;
}

export function resetMockBackend() {
  if (mockBackendInstance) {
    mockBackendInstance.reset();
  }
}

