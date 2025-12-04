/**
 * Formatting utilities for DevTools panel
 */

export function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  });
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return '-';
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return formatTime(timestamp);
}

export function formatDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
  return (ms / 60000).toFixed(1) + 'm';
}

export function formatRenderTime(time) {
  if (!time) return '0ms';
  if (time < 1) return time.toFixed(3) + 'ms';
  return time.toFixed(2) + 'ms';
}

export function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString();
    }
    if (value.includes('^^')) {
      const [text, lang] = value.split('^^');
      return `"${text}" [${lang}]`;
    }
    const str = value.length > 80 ? value.slice(0, 80) + '...' : value;
    return `"${str}"`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.slice(0, 5).map(v => formatSingleValue(v));
    if (value.length > 5) {
      items.push(`+${value.length - 5} more`);
    }
    return items.join(', ');
  }
  if (typeof value === 'object') {
    if (value._type === 'Model') return value.id;
    return JSON.stringify(value).slice(0, 50);
  }
  return String(value);
}

export function formatSingleValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString();
    }
    if (value.includes('^^')) {
      const [text, lang] = value.split('^^');
      return `"${text}" [${lang}]`;
    }
    const str = value.length > 40 ? value.slice(0, 40) + '...' : value;
    return `"${str}"`;
  }
  if (typeof value === 'object' && value._type === 'Model') {
    return value.id;
  }
  return String(value);
}

export function formatValueWithLinks(value) {
  if (value === null) return { text: 'null', links: [] };
  if (value === undefined) return { text: 'undefined', links: [] };
  if (typeof value === 'boolean') return { text: String(value), links: [] };
  if (typeof value === 'number') return { text: String(value), links: [] };
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return { text: new Date(value).toLocaleString(), links: [] };
    }
    if (value.includes('^^')) {
      const [text, lang] = value.split('^^');
      return { text: `"${text}" [${lang}]`, links: [] };
    }
    const str = value.length > 80 ? value.slice(0, 80) + '...' : value;
    return { text: `"${str}"`, links: [] };
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return { text: '[]', links: [] };
    const links = [];
    const textParts = [];
    for (const item of value) {
      if (typeof item === 'object' && item._type === 'Model') {
        links.push(item.id);
      } else {
        textParts.push(formatSingleValue(item));
      }
    }
    return { text: textParts.join(', '), links };
  }
  if (typeof value === 'object') {
    if (value._type === 'Model') {
      return { text: '', links: [value.id] };
    }
    return { text: JSON.stringify(value).slice(0, 50), links: [] };
  }
  return { text: String(value), links: [] };
}

export function getValueClass(value) {
  if (value === null) return 'value-null';
  if (value === undefined) return 'value-undefined';
  if (typeof value === 'boolean') return 'value-boolean';
  if (typeof value === 'number') return 'value-number';
  if (typeof value === 'string') return 'value-string';
  if (Array.isArray(value)) return 'value-array';
  if (typeof value === 'object') return 'value-object';
  return 'value-unknown';
}

