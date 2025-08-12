// Simple DSL to Node-RED compiler
// This is an initial, minimal implementation.
// It supports three inputs:
// 1) dsl.flow: an array of Node-RED nodes -> passed through
// 2) dsl.nodes: an array of Node-RED nodes -> passed through
// 3) Otherwise -> creates a minimal tab-only flow with description

const crypto = require('crypto');

function slugify(input) {
  if (!input || typeof input !== 'string') return 'workflow-' + crypto.randomBytes(4).toString('hex');
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-\s_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'workflow-' + crypto.randomBytes(4).toString('hex');
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compile a DSL JSON into a Node-RED flow
 * @param {object} dsl - The domain-specific DSL object
 * @returns {{ id: string, name: string, flow: Array }}
 */
function compile(dsl) {
  if (!dsl || typeof dsl !== 'object') {
    throw new Error('Invalid DSL: expected an object');
  }

  const name = (dsl.name && String(dsl.name)) || 'Workflow';
  const id = (dsl.id && String(dsl.id)) || slugify(name);

  let flow = [];

  if (Array.isArray(dsl.flow)) {
    flow = deepClone(dsl.flow);
  } else if (Array.isArray(dsl.nodes)) {
    flow = deepClone(dsl.nodes);
  } else {
    // Minimal default: only a tab; this still produces a valid, empty flow
    flow = [];
  }

  // Ensure there is a tab node at the beginning
  const tabIndex = flow.findIndex((n) => n && n.type === 'tab');
  const tabNode = {
    id,
    type: 'tab',
    label: name,
    info: dsl.description || dsl.info || ''
  };

  if (tabIndex === -1) {
    flow.unshift(tabNode);
  } else {
    // Replace existing with our computed id/name to keep consistency
    const originalId = flow[tabIndex].id;
    flow[tabIndex] = tabNode;

    // Update z references from original tab id to the compiled id
    flow.forEach((node, idx) => {
      if (idx !== tabIndex && node && node.z === originalId) node.z = id;
    });
  }

  // Ensure all non-tab nodes belong to this tab
  flow.forEach((node) => {
    if (node && node.type !== 'tab') {
      if (!node.z) node.z = id;
      // Generate missing node ids if needed
      if (!node.id) node.id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
      // Normalize wires
      if (node.wires && !Array.isArray(node.wires)) node.wires = [];
    }
  });

  return { id, name, flow };
}

module.exports = { compile, slugify };
