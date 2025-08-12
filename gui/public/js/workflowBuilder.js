// Workflow Builder (Beta) frontend logic
// Depends on Bootstrap toasts system via showToast() defined elsewhere

(function () {
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

  async function deployDSL() {
    const btn = document.getElementById('deploy-dsl-btn');
    const nameInput = document.getElementById('dsl-name');
    const editor = document.getElementById('dsl-editor');

    if (!editor) return;

    let dsl;
    try {
      dsl = getJson(editor);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
      return;
    }

    // Optional override of name via input
    const uiName = (nameInput && nameInput.value.trim()) || '';
    if (uiName) dsl.name = uiName;

    withButtonLoading(btn, true);
    try {
      const res = await fetch('/api/workflows/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dsl)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data && data.error ? data.error : 'Deploy failed');
      }

      showToast(`Deployed workflow "${data.name}" (id: ${data.id})`, 'success');

      // Refresh workflows tab if available
      if (typeof loadWorkflows === 'function') {
        setTimeout(loadWorkflows, 800);
      }
    } catch (err) {
      console.error('Deploy error', err);
      showToast('Deploy failed: ' + err.message, 'error');
    } finally {
      withButtonLoading(btn, false);
    }
  }

  function init() {
    const tab = document.querySelector('a[href="#workflow-builder"]');
    if (tab) {
      tab.addEventListener('shown.bs.tab', () => {
        // No-op for now; placeholder for future enhancements
      });
    }

    const btn = document.getElementById('deploy-dsl-btn');
    if (btn) btn.addEventListener('click', deployDSL);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
