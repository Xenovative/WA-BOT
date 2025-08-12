// Workflow Builder (Beta) frontend logic
// Depends on: Drawflow (global), showToast() from existing UI

(function () {
  let df; // Drawflow instance
  let dfMounted = false;
  let idCounter = 0;

  const NODES = {
    // Bot-focused nodes
    wa_in: {
      name: 'wa_in', inputs: 0, outputs: 1,
      defaults: { name: 'On WhatsApp Message' }
    },
    wa_send: {
      name: 'wa_send', inputs: 1, outputs: 1,
      defaults: { name: 'Send WhatsApp', chatId: '', message: '', fromPayload: true }
    },
    keyword: {
      name: 'keyword', inputs: 1, outputs: 2,
      defaults: { name: 'Keyword Filter', pattern: 'hi|hello', caseInsensitive: true, source: 'text' }
    },
    // Generic logic nodes
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
    } else if (type === 'wa_send') {
      fields.push(`
        <div class="mb-2">
          <label class="form-label">Chat ID (optional)</label>
          <input type="text" class="form-control" data-field="chatId" placeholder="e.g. 85290897701@c.us" value="${escapeHtml(data.chatId || '')}">
          <div class="form-text">Defaults to <code>msg.chatId</code> or <code>msg.from</code> when empty.</div>
        </div>
        <div class="mb-2 form-check">
          <input class="form-check-input" type="checkbox" data-field="fromPayload" ${data.fromPayload ? 'checked' : ''} id="fld-fromPayload">
          <label class="form-check-label" for="fld-fromPayload">Use <code>msg.text</code> / <code>msg.payload</code> as message</label>
        </div>
        <div class="mb-2">
          <label class="form-label">Message (used when not from payload)</label>
          <textarea class="form-control" rows="3" data-field="message" placeholder="Hello!">${escapeHtml(data.message || '')}</textarea>
        </div>`);
    } else if (type === 'keyword') {
      fields.push(`
        <div class="mb-2">
          <label class="form-label">Pattern</label>
          <input type="text" class="form-control" data-field="pattern" value="${escapeHtml(data.pattern || 'hi|hello')}">
          <div class="form-text">Pipe-separated or regex (e.g. <code>hi|hello</code>)</div>
        </div>
        <div class="mb-2">
          <label class="form-label">Source</label>
          <select class="form-select" data-field="source">
            <option value="text" ${data.source === 'text' ? 'selected' : ''}>msg.text</option>
            <option value="payload" ${data.source === 'payload' ? 'selected' : ''}>msg.payload</option>
          </select>
        </div>
        <div class="mb-2 form-check">
          <input class="form-check-input" type="checkbox" data-field="caseInsensitive" ${data.caseInsensitive ? 'checked' : ''} id="fld-ci">
          <label class="form-check-label" for="fld-ci">Case insensitive</label>
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
    const extraNodes = [];
    let mqttConfigId = null;
    function ensureMqttConfig() {
      if (mqttConfigId) return mqttConfigId;
      mqttConfigId = uniq('mqtt');
      // Minimal mqtt-broker config node
      extraNodes.push({
        id: mqttConfigId,
        type: 'mqtt-broker',
        name: 'Local MQTT',
        broker: 'localhost',
        port: '1883',
        clientid: '',
        usetls: false,
        protocolVersion: '4',
        keepalive: '60',
        cleansession: true,
        birthTopic: '', birthQos: '0', birthRetain: false, birthPayload: '',
        closeTopic: '', closePayload: '',
        willTopic: '', willQos: '0', willRetain: false, willPayload: ''
      });
      return mqttConfigId;
    }
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
      } else if (n.name === 'wa_in') {
        // Compile to MQTT IN node subscribed to whatsapp/messages
        base.type = 'mqtt in';
        base.topic = 'whatsapp/messages';
        base.qos = '1';
        base.datatype = 'json';
        base.broker = ensureMqttConfig();
        base._visual = 'wa_in';
        base._data = d;
      } else if (n.name === 'wa_send') {
        // Compile to a function node that uses functionGlobalContext.bot
        base.type = 'function';
        base.outputs = 1;
        const esc = (s) => String(s).replace(/`/g, '\\`');
        const staticMsg = esc(d.message || '');
        const usePayload = !!d.fromPayload;
        const chatIdStr = esc(d.chatId || '');
        base._visual = 'wa_send';
        base._data = d;
        base.func = `
// Send WhatsApp message using bot in functionGlobalContext
const bot = global.get('bot');
if (!bot || !bot.whatsappClient) {
  node.warn('WhatsApp client not available');
  return msg;
}
const p = (msg && typeof msg.payload === 'object') ? msg.payload : {};
const target = (${JSON.stringify(!!chatIdStr)} && '${chatIdStr}') || msg.chatId || msg.to || p.chatId || (p.originalMessage && p.originalMessage.from) || msg.from;
const text = ${usePayload ? `(
  (typeof msg.text !== 'undefined' && String(msg.text)) ||
  (typeof p.text !== 'undefined' && String(p.text)) ||
  (typeof msg.payload === 'string' ? msg.payload : (typeof p.body !== 'undefined' ? String(p.body) : ''))
)` : `'${staticMsg}'`};
try {
  // Fire-and-forget; Node-RED function won't await
  bot.whatsappClient.client.sendMessage(target, text)
    .then(() => node.status({fill:'green',shape:'dot',text:'sent'}))
    .catch(err => node.error('Send failed: ' + err.message));
} catch (e) {
  node.error('Send error: ' + e.message);
}
return msg;`.trim();
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
      } else if (n.name === 'keyword') {
        // Compile to function node with 2 outputs: [match, no-match]
        base.type = 'function';
        base.outputs = 2;
        const src = (d.source === 'payload') ? 'payload' : 'text';
        const flags = d.caseInsensitive ? 'i' : '';
        const pat = String(d.pattern || '');
        const esc = (s) => s.replace(/`/g, '\\`');
        base._visual = 'keyword';
        base._data = d;
        base.func = `
// Keyword filter: output[0]=match, output[1]=no match
const p = (msg && typeof msg.payload === 'object') ? msg.payload : {};
let srcVal;
if ('${src}' === 'payload') {
  srcVal = (typeof msg.payload === 'string') ? msg.payload : (typeof p.body !== 'undefined' ? String(p.body) : '');
} else {
  srcVal = (typeof msg.text !== 'undefined') ? String(msg.text) : (typeof p.text !== 'undefined' ? String(p.text) : '');
}
const re = new RegExp(${JSON.stringify(pat)}, '${flags}');
if (re.test(srcVal)) { return [msg, null]; }
return [null, msg];`.trim();
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

    // Include any required config nodes
    const out = { name: flowName, nodes: nodes.concat(extraNodes) };
    return out;
  }

  function importFromDSL(dsl) {
    if (!df) return;
    df.clear();
    const nodes = dsl.flow || dsl.nodes || [];
    const gridX = 220, gridY = 140;
    const posIndex = {};
    const added = {};

    // First pass: add nodes (skip tab/config nodes)
    nodes.forEach((n, i) => {
      if (!n || n.type === 'tab' || n.type === 'mqtt-broker' || /-broker$/.test(n.type || '')) return;
      // Choose a visual type pref from metadata, else heuristic mapping
      let type = n._visual || n.type || 'function';
      if (!NODES[type]) {
        if (n.type === 'mqtt in' && n.topic === 'whatsapp/messages') type = 'wa_in';
        else type = 'function';
      }
      const def = NODES[type] || NODES.function;
      const col = i % 4, row = Math.floor(i / 4);
      const x = 100 + col * gridX;
      const y = 80 + row * gridY;
      const data = Object.assign({}, def.defaults);
      data.name = n.name || def.name;
      // copy specific config
      if (type === 'function' && n.func) data.func = n.func;
      // Restore metadata-backed configs for our visual nodes
      if (n._data && typeof n._data === 'object') {
        Object.assign(data, n._data);
      }
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
      setTimeout(refreshLoadList, 800);
    } catch (err) {
      console.error(err);
      showToast('Deploy failed: ' + err.message, 'error');
    } finally {
      withButtonLoading(btn, false);
    }
  }

  async function saveDSL() {
    const btn = document.getElementById('save-dsl-btn');
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
      const res = await fetch('/api/workflows/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dsl)
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Save failed');
      showToast(`Saved workflow "${data.name}" (id: ${data.id})`, 'success');
      if (typeof loadWorkflows === 'function') setTimeout(loadWorkflows, 800);
      setTimeout(refreshLoadList, 800);
    } catch (err) {
      console.error(err);
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      withButtonLoading(btn, false);
    }
  }

  async function refreshLoadList() {
    const select = document.getElementById('load-workflow-select');
    if (!select) return;
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to list workflows');
      const current = select.value;
      select.innerHTML = '<option value="" disabled selected>Choose workflow…</option>';
      data.workflows.forEach(w => {
        const opt = document.createElement('option');
        opt.value = w.id;
        opt.textContent = w.name || w.id;
        select.appendChild(opt);
      });
      // Try to preserve previous selection
      if (current) select.value = current;
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSelectedWorkflow() {
    const select = document.getElementById('load-workflow-select');
    const id = select?.value;
    if (!id) { showToast('Pick a workflow to load', 'error'); return; }
    const btn = document.getElementById('load-dsl-btn');
    withButtonLoading(btn, true);
    try {
      const res = await fetch(`/api/workflows/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to fetch workflow');
      const wf = data.workflow;
      // Switch to visual mode and import full flow to keep wires/config
      setMode('visual');
      mountDrawflow();
      importFromDSL({ flow: wf.config });
      const nameInput = document.getElementById('dsl-name');
      if (nameInput) nameInput.value = wf.name || id;
      // Sync JSON editor too
      const ta = document.getElementById('dsl-editor');
      if (ta) ta.value = JSON.stringify({ flow: wf.config, name: wf.name || id }, null, 2);
      showToast(`Loaded workflow "${wf.name || id}"`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Load failed: ' + err.message, 'error');
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

    // Save
    document.getElementById('save-dsl-btn')?.addEventListener('click', saveDSL);

    // Load controls
    document.getElementById('refresh-load-list-btn')?.addEventListener('click', refreshLoadList);
    document.getElementById('load-dsl-btn')?.addEventListener('click', loadSelectedWorkflow);

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

    // Populate load list initially
    refreshLoadList();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
