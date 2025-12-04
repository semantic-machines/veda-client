/**
 * Graph View - Renders dependency graph using Canvas
 */

import { Component, html } from '../../../src/index.js';

export default class GraphView extends Component(HTMLElement) {
  static tag = 'graph-view';

  constructor() {
    super();
    this.state.nodes = [];
    this.state.edges = [];
    this.canvas = null;
    this.ctx = null;
    this.nodePositions = new Map();
    this.hoveredNode = null;
    this.selectedNode = null;
    this.isDragging = false;
    this.dragNode = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  async connectedCallback() {
    await super.connectedCallback();
    this.setupCanvas();
    this.calculateLayout();
    this.draw();

    // Re-draw when state changes
    this._observer = () => {
      this.calculateLayout();
      this.draw();
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback?.();
  }

  setupCanvas() {
    this.canvas = this.querySelector('canvas');
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');

    // Handle resize
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Mouse events
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 800;
    this.canvas.height = rect.height || 500;
    this.draw();
  }

  calculateLayout() {
    const nodes = this.state.nodes || [];
    if (nodes.length === 0) return;

    // Simple force-directed layout
    const width = this.canvas?.width || 800;
    const height = this.canvas?.height || 500;

    // Initialize positions if needed
    nodes.forEach((node, i) => {
      if (!this.nodePositions.has(node.id)) {
        // Group by type
        let x, y;
        if (node.type === 'component') {
          x = 100 + (i % 5) * 120;
          y = 80 + Math.floor(i / 5) * 100;
        } else if (node.type === 'model') {
          x = width - 200 + (i % 3) * 80;
          y = 80 + Math.floor(i / 3) * 80;
        } else {
          x = width / 2 + (i % 4) * 80;
          y = height - 150 + Math.floor(i / 4) * 60;
        }
        this.nodePositions.set(node.id, { x, y, vx: 0, vy: 0 });
      }
    });

    // Apply force simulation (simplified)
    const edges = this.state.edges || [];
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const pos1 = this.nodePositions.get(nodes[i].id);
          const pos2 = this.nodePositions.get(nodes[j].id);
          if (!pos1 || !pos2) continue;

          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);

          pos1.vx -= (dx / dist) * force;
          pos1.vy -= (dy / dist) * force;
          pos2.vx += (dx / dist) * force;
          pos2.vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      edges.forEach(edge => {
        const pos1 = this.nodePositions.get(edge.source);
        const pos2 = this.nodePositions.get(edge.target);
        if (!pos1 || !pos2) return;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.01;

        pos1.vx += (dx / dist) * force;
        pos1.vy += (dy / dist) * force;
        pos2.vx -= (dx / dist) * force;
        pos2.vy -= (dy / dist) * force;
      });

      // Apply velocities with damping
      nodes.forEach(node => {
        const pos = this.nodePositions.get(node.id);
        if (!pos) return;

        pos.x += pos.vx * 0.1;
        pos.y += pos.vy * 0.1;
        pos.vx *= 0.9;
        pos.vy *= 0.9;

        // Keep in bounds
        pos.x = Math.max(50, Math.min(width - 50, pos.x));
        pos.y = Math.max(30, Math.min(height - 30, pos.y));
      });
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.scale, this.scale);

    // Draw edges
    const edges = this.state.edges || [];
    edges.forEach(edge => {
      const pos1 = this.nodePositions.get(edge.source);
      const pos2 = this.nodePositions.get(edge.target);
      if (!pos1 || !pos2) return;

      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);

      // Style based on edge type
      if (edge.type === 'parent-child') {
        ctx.strokeStyle = '#3c3c3c';
        ctx.setLineDash([]);
      } else if (edge.type === 'uses-model') {
        ctx.strokeStyle = '#c586c0';
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = '#6a6a6a';
        ctx.setLineDash([2, 2]);
      }

      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw arrow
      const angle = Math.atan2(pos2.y - pos1.y, pos2.x - pos1.x);
      const arrowLen = 8;
      ctx.beginPath();
      ctx.moveTo(pos2.x - arrowLen * Math.cos(angle - 0.3), pos2.y - arrowLen * Math.sin(angle - 0.3));
      ctx.lineTo(pos2.x, pos2.y);
      ctx.lineTo(pos2.x - arrowLen * Math.cos(angle + 0.3), pos2.y - arrowLen * Math.sin(angle + 0.3));
      ctx.strokeStyle = ctx.strokeStyle;
      ctx.stroke();
    });

    // Draw nodes
    const nodes = this.state.nodes || [];
    nodes.forEach(node => {
      const pos = this.nodePositions.get(node.id);
      if (!pos) return;

      const isHovered = this.hoveredNode === node.id;
      const isSelected = this.selectedNode === node.id;

      // Node colors by type
      let bgColor, borderColor, textColor;
      if (node.type === 'component') {
        bgColor = '#094771';
        borderColor = '#4ec9b0';
        textColor = '#4ec9b0';
      } else if (node.type === 'model') {
        bgColor = '#4a2545';
        borderColor = '#c586c0';
        textColor = '#c586c0';
      } else {
        bgColor = '#4a4500';
        borderColor = '#dcdcaa';
        textColor = '#dcdcaa';
      }

      // Draw node background
      ctx.beginPath();
      const nodeWidth = Math.max(60, ctx.measureText(node.label).width + 20);
      const nodeHeight = 28;

      ctx.roundRect(pos.x - nodeWidth / 2, pos.y - nodeHeight / 2, nodeWidth, nodeHeight, 4);
      ctx.fillStyle = isHovered || isSelected ? borderColor : bgColor;
      ctx.fill();

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Draw label
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = isHovered || isSelected ? bgColor : textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, pos.x, pos.y);
    });

    ctx.restore();

    // Draw tooltip for hovered node
    if (this.hoveredNode) {
      const node = nodes.find(n => n.id === this.hoveredNode);
      const pos = this.nodePositions.get(this.hoveredNode);
      if (node && pos) {
        const tooltipX = pos.x * this.scale + this.panX;
        const tooltipY = pos.y * this.scale + this.panY - 30;

        let tooltipText = node.label;
        if (node.data) {
          if (node.data.renderCount !== undefined) {
            tooltipText += ` (${node.data.renderCount} renders)`;
          }
          if (node.data.updateCount !== undefined) {
            tooltipText += ` (${node.data.updateCount} updates)`;
          }
          if (node.data.triggerCount !== undefined) {
            tooltipText += ` (${node.data.triggerCount} triggers)`;
          }
        }

        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const textWidth = ctx.measureText(tooltipText).width;

        ctx.fillStyle = '#252526';
        ctx.strokeStyle = '#3c3c3c';
        ctx.beginPath();
        ctx.roundRect(tooltipX - textWidth / 2 - 8, tooltipY - 12, textWidth + 16, 24, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#d4d4d4';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tooltipText, tooltipX, tooltipY);
      }
    }
  }

  getNodeAtPosition(x, y) {
    const nodes = this.state.nodes || [];
    const ctx = this.ctx;
    if (!ctx) return null;

    // Transform coordinates
    const tx = (x - this.panX) / this.scale;
    const ty = (y - this.panY) / this.scale;

    for (const node of nodes) {
      const pos = this.nodePositions.get(node.id);
      if (!pos) continue;

      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      const nodeWidth = Math.max(60, ctx.measureText(node.label).width + 20);
      const nodeHeight = 28;

      if (tx >= pos.x - nodeWidth / 2 && tx <= pos.x + nodeWidth / 2 &&
          ty >= pos.y - nodeHeight / 2 && ty <= pos.y + nodeHeight / 2) {
        return node;
      }
    }
    return null;
  }

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (this.isDragging && this.dragNode) {
      const pos = this.nodePositions.get(this.dragNode);
      if (pos) {
        pos.x = (x - this.panX) / this.scale;
        pos.y = (y - this.panY) / this.scale;
        this.draw();
      }
      return;
    }

    const node = this.getNodeAtPosition(x, y);
    const newHovered = node ? node.id : null;

    if (newHovered !== this.hoveredNode) {
      this.hoveredNode = newHovered;
      this.canvas.style.cursor = newHovered ? 'pointer' : 'default';
      this.draw();
    }
  }

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const node = this.getNodeAtPosition(x, y);
    if (node) {
      this.isDragging = true;
      this.dragNode = node.id;
      this.selectedNode = node.id;
      this.draw();
    }
  }

  handleMouseUp(e) {
    this.isDragging = false;
    this.dragNode = null;
  }

  handleMouseLeave() {
    this.hoveredNode = null;
    this.isDragging = false;
    this.dragNode = null;
    this.draw();
  }

  handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    this.scale = Math.max(0.3, Math.min(3, this.scale * delta));
    this.draw();
  }

  render() {
    // Trigger layout calculation when nodes change
    setTimeout(() => {
      this.setupCanvas();
      this.calculateLayout();
      this.draw();
    }, 0);

    return html`
      <canvas class="graph-canvas"></canvas>
    `;
  }
}

