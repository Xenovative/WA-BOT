// Workflow Builder (Beta) frontend logic
// Depends on: Drawflow (global), showToast() from existing UI

(function () {
  let df; // Drawflow instance
  let dfMounted = false;
  let idCounter = 0;

  const NODES = {
    inject: {
      name: 'inject', inputs: 0, outputs: 1,
      defaults: { name: 'Trigger', once: true, onceDelay: 0.1 }
    },
    debug: {
      name: 'debug', inputs: 1, outputs: 0,
      defaults: { name: 'Log', active: true, tosidebar: true }
    },
    function: {
      name: 'function', inputs: 1, outputs: 1,
      defaults: { name: 'Function', func: 'return msg;' }
    },
    switch: {
      name: 'switch', inputs: 1, outputs: 2,
      defaults: { name: 'Switch', property: 'payload' }
    },
    delay: {
      name: 'delay', inputs: 1, outputs: 1,
      defaults: { name: 'Delay', seconds: 5 }
    }
  };

  function uniq(prefix = 'n') {
    idCounter = (idCounter + 1) % 1e9;
    const rnd = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${idCounter}_${rnd}`;
  }

  function getJson(el) {
    try {
      return JSON.parse(el.value);
    } catch (e) {
      throw new Error('Invalid JSON: ' + e.message);
    }
  }

  function withButtonLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.dataset.origHtml = btn.dataset.origHtml || btn.innerHTML;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>' + (btn.textContent.trim() || 'Working...');
    } else {
      btn.disabled = false;
      if (btn.dataset.origHtml) btn.innerHTML = btn.dataset.origHtml;
    }
  }

  function ensureNodeRedId(dataObj) {
    if (!dataObj) return;
    if (!dataObj.noderedId) dataObj.noderedId = uniq('nr');
    return dataObj.noderedId;
  }

  function mountDrawflow() {
    const el = document.getElementById('drawflow');
    if (!el || dfMounted) return;
    df = new Drawflow(el);
    df.reroute = true;
    df.start();
    dfMounted = true;

    // Selection -> inspector
    df.on('nodeSelected', id => renderInspector(id));
    df.on('nodeDataChanged', id => renderInspector(id));
    df.on('nodeRemoved', id => clearInspectorIfRemoved(id));

    // Palette
    document.querySelectorAll('.node-palette [data-node-type]').forEach(btn => {
      btn.addEventListener('click', () => addNode(btn.dataset.nodeType));
    });
  }

  function addNode(type, pos) {
    const def = NODES[type];
    if (!def) return showToast(`Unknown node type: ${type}`, 'error');
    const x = pos?.x ?? 200 + Math.random() * 100;
    const y = pos?.y ?? 100 + Math.random() * 100;
    const data = JSON.parse(JSON.stringify(def.defaults));
    ensureNodeRedId(data);
    const html = `<div class="p-1"><strong>${def.name}</strong><div class="small text-muted">${data.name || ''}</div></div>`;
    const id = df.addNode(def.name, def.inputs, def.outputs, x, y, def.name, data, html);
    df.updateNodeDataFromId(id, data); // ensure persisted
    return id;
  }

  function clearInspectorIfRemoved(id) {
    const panel = document.getElementById('inspector-content');
    if (!panel) return;
    const selected = df?.getSelectedNode();
    if (!selected || selected !== id) {
      // noop
    }
    if (!df?.getNodeFromId?.(id)) {
      panel.innerHTML = 'Select a node to edit its properties.';
    }
  }

  function renderInspector(id) {
    const panel = document.getElementById('inspector-content');
    if (!panel || !df) return;
    const node = df.getNodeFromId(id);
    if (!node) { panel.innerHTML = 'Select a node to edit its properties.'; return; }
    const type = node.name;
    const data = node.data || {};

    const fields = [];
    // Common: name
    fields.push(`
      <div class="mb-2">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" data-field="name" value="${escapeHtml(data.name || '')}">
      </div>`);

    if (type === 'function') {
      fields.push(`
        <div class="mb-2">
          <label class="form-label">Code</label>
          <textarea class="form-control" rows="6" data-field="func">${escapeHtml(data.func || 'return msg;')}</textarea>
          <div class="form-text">The function receives and returns <code>msg</code>.</div>
        </div>`);
    } else if (type === 'inject') {
      fields.push(`
        <div class="mb-2 form-check">
          <input class="form-check-input" type="checkbox" data-field="once" ${data.once ? 'checked' : ''} id="fld-once">
          <label class="form-check-label" for="fld-once">Once on start</label>
        </div>
        <div class="mb-2">
          <label class="form-label">Delay (s)</label>
          <input type="number" step="0.1" min="0" class="form-control" data-field="onceDelay" value="${Number(data.onceDelay ?? 0.1)}">
        </div>`);
    } else if (type === 'delay') {
      fields.push(`
        <div class="mb-2">
          <label class="form-label">Delay (s)</label>
          <input type="number" min="0" class="form-control" data-field="seconds" value="${Number(data.seconds ?? 5)}">
        </div>`);
    } else if (type === 'debug') {
      fields.push(`
        <div class="mb-2 form-check">
          <input class="form-check-input" type="checkbox" data-field="active" ${data.active ? 'checked' : ''} id="fld-active">
          <label class="form-check-label" for="fld-active">Active</label>
        </div>
        <div class="mb-2 form-check">
          <input class="form-check-input" type="checkbox" data-field="tosidebar" ${data.tosidebar ? 'checked' : ''} id="fld-sidebar">
          <label class="form-check-label" for="fld-sidebar">To sidebar</label>
        </div>`);
    } else if (type === 'switch') {
      fields.push(`
        <div class="mb-2">
          <label class="form-label">Property</label>
          <input type="text" class="form-control" data-field="property" value="${escapeHtml(data.property || 'payload')}">
          <div class="form-text">Evaluates msg.<em>property</em></div>
        </div>`);
    }

    panel.innerHTML = fields.join('');
    panel.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => inspectorCommit(id));
      el.addEventListener('change', () => inspectorCommit(id));
    });
  }

  function inspectorCommit(id) {
    const node = df.getNodeFromId(id);
    if (!node) return;
    const panel = document.getElementById('inspector-content');
    if (!panel) return;
    const data = Object.assign({}, node.data);
    panel.querySelectorAll('[data-field]').forEach(el => {
      const key = el.getAttribute('data-field');
      if (el.type === 'checkbox') data[key] = !!el.checked;
      else if (el.type === 'number') data[key] = Number(el.value);
      else data[key] = el.value;
    });
    ensureNodeRedId(data);
    df.updateNodeDataFromId(id, data);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }

  function exportToDSL() {
    const nameInput = document.getElementById('dsl-name');
    const flowName = (nameInput && nameInput.value.trim()) || 'Visual Flow';
    if (!df) return { name: flowName, nodes: [] };
    const exp = df.export();
    const data = (exp && exp.drawflow && exp.drawflow.Home && exp.drawflow.Home.data) || {};

    // Build mapping for IDs and wires
    const nodes = [];
    const idMap = {}; // drawflow id -> node-red id
    Object.keys(data).forEach(dfId => {
      const n = data[dfId];
      const info = NODES[n.name] || { inputs: 1, outputs: 1 };
      const d = Object.assign({}, n.data);
      const nrid = ensureNodeRedId(d);
      idMap[dfId] = nrid;

      const base = { id: nrid, type: n.name, name: d.name || n.name };
      // create empty wires array per output
      const outputs = Number(info.outputs || 0);
      if (outputs > 0) base.wires = Array.from({ length: outputs }, () => []);

      // Node-RED specific fields by type
      if (n.name === 'function') {
        base.func = d.func || 'return msg;';
        base.outputs = 1;
      } else if (n.name === 'inject') {
        base.props = [{ p: 'payload' }];
        base.repeat = '';
        base.once = !!d.once;
        base.onceDelay = Number(d.onceDelay ?? 0.1);
      } else if (n.name === 'debug') {
        base.active = d.active !== false;
        base.tosidebar = d.tosidebar !== false;
      } else if (n.name === 'delay') {
        base.pauseType = 'delay';
        base.timeout = String(Number(d.seconds ?? 5));
        base.timeoutUnits = 'seconds';
      } else if (n.name === 'switch') {
        base.property = `payload`;
        base.propertyType = 'msg';
        base.rules = [{ t: 'truthy' }, { t: 'else' }];
        base.checkall = 'true';
        base.outputs = 2;
      }

      nodes.push(base);
    });

    // Populate wires using connections
    Object.keys(data).forEach(dfId => {
      const n = data[dfId];
      const nrid = idMap[dfId];
      const target = nodes.find(x => x.id === nrid);
      if (!target) return;
      const outputs = n.outputs || {};
      Object.keys(outputs).forEach(outKey => {
        const idx = Number(outKey.replace('output_', '')) - 1;
        const conns = outputs[outKey].connections || [];
        conns.forEach(c => {
          const toNrId = idMap[c.node];
          if (!toNrId) return;
          if (!target.wires) target.wires = [];
          if (!target.wires[idx]) target.wires[idx] = [];
          target.wires[idx].push(toNrId);
        });
      });
    });

    return { name: flowName, nodes };
  }

  function importFromDSL(dsl) {
    if (!df) return;
    df.clear();
    const nodes = dsl.flow || dsl.nodes || [];
    const gridX = 220, gridY = 140;
    const posIndex = {};
    const added = {};

    // First pass: add nodes
    nodes.forEach((n, i) => {
      const type = n.type || 'function';
      const def = NODES[type] || NODES.function;
      const col = i % 4, row = Math.floor(i / 4);
      const x = 100 + col * gridX;
      const y = 80 + row * gridY;
      const data = Object.assign({}, def.defaults);
      data.name = n.name || def.name;
      // copy specific config
      if (type === 'function' && n.func) data.func = n.func;
      if (type === 'inject') {
        data.once = n.once ?? true;
        data.onceDelay = n.onceDelay ?? 0.1;
      }
      if (type === 'debug') {
        data.active = n.active !== false;
        data.tosidebar = n.tosidebar !== false;
      }
      if (type === 'delay') {
        data.seconds = Number(n.timeout || n.seconds || 5);
      }
      ensureNodeRedId(data);
      if (n.id) data.noderedId = n.id; // preserve
      const html = `<div class="p-1"><strong>${def.name}</strong><div class="small text-muted">${data.name || ''}</div></div>`;
      const dfId = df.addNode(def.name, def.inputs, def.outputs, x, y, def.name, data, html);
      added[n.id || data.noderedId] = dfId;
      posIndex[dfId] = { x, y };
    });

    // Second pass: wires
    nodes.forEach(n => {
      if (!n.wires || !Array.isArray(n.wires)) return;
      const fromDfId = added[n.id];
      if (!fromDfId) return;
      n.wires.forEach((arr, outputIdx) => {
        (arr || []).forEach(targetId => {
          const toDfId = added[targetId];
          if (toDfId) {
            try { df.addConnection(fromDfId, toDfId, 'output_' + (outputIdx + 1), 'input_1'); } catch {}
          }
        });
      });
    });
  }

  function setMode(mode) {
    const visual = document.getElementById('builder-visual');
    const json = document.getElementById('builder-json');
    const btnV = document.getElementById('mode-visual-btn');
    const btnJ = document.getElementById('mode-json-btn');
    if (!visual || !json) return;
    if (mode === 'visual') {
      visual.style.display = '';
      json.style.display = 'none';
      btnV?.classList.add('active');
      btnJ?.classList.remove('active');
      // ensure canvas mounted and sized
      mountDrawflow();
      setTimeout(() => df?.editor?.resize?.(), 0);
    } else {
      // sync JSON from visual
      const dsl = exportToDSL();
      const ta = document.getElementById('dsl-editor');
      if (ta) ta.value = JSON.stringify(dsl, null, 2);
      visual.style.display = 'none';
      json.style.display = '';
      btnJ?.classList.add('active');
      btnV?.classList.remove('active');
    }
  }

  async function deploy() {
    const btn = document.getElementById('deploy-dsl-btn');
    const isVisual = document.getElementById('builder-json')?.style.display === 'none';
    let dsl;
    if (isVisual) {
      dsl = exportToDSL();
    } else {
      const nameInput = document.getElementById('dsl-name');
      const editorEl = document.getElementById('dsl-editor');
      if (!editorEl) return;
      try { dsl = getJson(editorEl); } catch (e) { showToast(e.message, 'error'); return; }
      const uiName = (nameInput && nameInput.value.trim()) || '';
      if (uiName) dsl.name = uiName;
    }

    withButtonLoading(btn, true);
    try {
      const res = await fetch('/api/workflows/deploy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dsl)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Deploy failed');
      showToast(`Deployed workflow "${data.name}" (id: ${data.id})`, 'success');
      if (typeof loadWorkflows === 'function') setTimeout(loadWorkflows, 800);
    } catch (err) {
      console.error(err);
      showToast('Deploy failed: ' + err.message, 'error');
    } finally {
      withButtonLoading(btn, false);
    }
  }

  function init() {
    // Tab show hook ensures Drawflow is mounted when user opens the tab
    const tab = document.querySelector('a[href="#workflow-builder"]');
    if (tab) {
      tab.addEventListener('shown.bs.tab', () => {
        mountDrawflow();
      });
    }

    // Mode toggles
    document.getElementById('mode-visual-btn')?.addEventListener('click', () => setMode('visual'));
    document.getElementById('mode-json-btn')?.addEventListener('click', () => setMode('json'));

    // Deploy
    document.getElementById('deploy-dsl-btn')?.addEventListener('click', deploy);

    // If user switches to visual after editing JSON, import it
    const visualBtn = document.getElementById('mode-visual-btn');
    if (visualBtn) {
      visualBtn.addEventListener('click', () => {
        try {
          const ta = document.getElementById('dsl-editor');
          if (!ta) return;
          const json = JSON.parse(ta.value || '{}');
          mountDrawflow();
          importFromDSL(json);
        } catch (e) {
          // ignore, stay with current graph
        }
      });
    }

    // Auto-mount if the tab is already active in DOM
    if (document.getElementById('workflow-builder')?.classList.contains('active')) {
      mountDrawflow();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
