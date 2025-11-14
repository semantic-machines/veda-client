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
  }

  async authenticate(login, password) {
    await this.#delay();
    this.authenticated = true;
    this.currentUser = login;
    return true;
  }

  async get_individual(id, useCache = true) {
    await this.#delay();
    if (!this.storage.has(id)) {
      throw new Error(`Individual ${id} not found`);
    }
    return this.storage.get(id);
  }

  async put_individual(individual) {
    await this.#delay();
    const id = individual['@'];
    if (!id) {
      throw new Error('Individual must have @ property');
    }
    this.storage.set(id, individual);
    return id;
  }

  async remove_individual(id) {
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

  async #delay() {
    if (this.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delay));
    }
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

