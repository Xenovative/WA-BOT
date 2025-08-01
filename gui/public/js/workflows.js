/**
 * Workflows management functionality for WhatsXENO
 */

// Initialize workflows functionality when document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize workflow tab events
    initWorkflowEvents();
    
    // Handle workflows tab visibility
    const workflowsTab = document.querySelector('a[href="#workflows"]');
    if (workflowsTab) {
        // Load workflows when tab is shown
        workflowsTab.addEventListener('shown.bs.tab', function(e) {
            if (e.target.getAttribute('href') === '#workflows') {
                loadWorkflows();
            }
        });
    }
    
    // If workflows tab is active on page load, load workflows
    if (window.location.hash === '#workflows' || 
        (window.location.hash === '' && document.querySelector('.nav-link.active')?.getAttribute('href') === '#workflows')) {
        loadWorkflows();
    }
});

// Initialize workflow-related event listeners
function initWorkflowEvents() {
    // Refresh workflows button
    document.getElementById('refresh-workflows').addEventListener('click', function() {
        loadWorkflows();
    });
    
    // Workflow toggle switches
    document.querySelectorAll('.form-check-input[id^="workflow-"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const workflowId = this.id.replace('workflow-', '');
            const enabled = this.checked;
            toggleWorkflow(workflowId, enabled);
        });
    });
    
    // View workflow details buttons
    document.querySelectorAll('button[data-workflow]').forEach(button => {
        button.addEventListener('click', function() {
            const workflowFile = this.getAttribute('data-workflow');
            viewWorkflowDetails(workflowFile);
        });
    });
}

// Load available workflows from the server
function loadWorkflows() {
    fetch('/api/workflows')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayWorkflows(data.workflows);
            } else {
                const errorMsg = window.i18n ? window.i18n.t('workflow.load_error') + data.error : 'Failed to load workflows: ' + data.error;
                showToast(errorMsg, 'error');
            }
        })
        .catch(error => {
            console.error('Error loading workflows:', error);
            const errorMsg = window.i18n ? window.i18n.t('workflow.load_failed') : 'Failed to load workflows';
            showToast(errorMsg, 'error');
        });
}

// Display workflows in the table
function displayWorkflows(workflows) {
    const tableBody = document.getElementById('workflows-table-body');
    const noWorkflows = document.getElementById('no-workflows');
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    if (workflows && workflows.length > 0) {
        workflows.forEach(workflow => {
            const row = document.createElement('tr');
            
            // Create workflow row
            const noDescription = window.i18n ? window.i18n.t('workflow.no_description') : 'No description';
            const enabledText = window.i18n ? window.i18n.t('workflow.enabled') : 'Enabled';
            const disabledText = window.i18n ? window.i18n.t('workflow.disabled') : 'Disabled';
            const enableText = window.i18n ? window.i18n.t('workflow.enable') : 'Enable';
            const disableText = window.i18n ? window.i18n.t('workflow.disable') : 'Disable';
            const viewText = window.i18n ? window.i18n.t('workflow.view') : 'View';
            
            row.innerHTML = `
                <td>${workflow.name}</td>
                <td>${workflow.description || noDescription}</td>
                <td>
                    <span class="badge ${workflow.enabled ? 'bg-success' : 'bg-secondary'}">
                        ${workflow.enabled ? enabledText : disabledText}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm" role="group">
                        <button type="button" class="btn btn-outline-primary workflow-toggle" 
                                data-id="${workflow.id}" data-enabled="${workflow.enabled}">
                            ${workflow.enabled ? `<i class="bi bi-toggle-on"></i> ${disableText}` : `<i class="bi bi-toggle-off"></i> ${enableText}`}
                        </button>
                        <button type="button" class="btn btn-outline-secondary workflow-view" 
                                data-id="${workflow.id}">
                            <i class="bi bi-eye"></i> ${viewText}
                        </button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
        
        // Add event listeners to the new buttons
        document.querySelectorAll('.workflow-toggle').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const currentlyEnabled = this.getAttribute('data-enabled') === 'true';
                toggleWorkflow(id, !currentlyEnabled);
            });
        });
        
        document.querySelectorAll('.workflow-view').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                viewWorkflowDetails(id);
            });
        });
        
        // Show table, hide no workflows message
        tableBody.closest('.table-responsive').style.display = '';
        noWorkflows.style.display = 'none';
    } else {
        // Hide table, show no workflows message
        tableBody.closest('.table-responsive').style.display = 'none';
        noWorkflows.style.display = 'block';
    }
    
    // Update the predefined workflow toggles
    updatePredefinedWorkflowToggles(workflows);
}

// Update the predefined workflow toggle states
function updatePredefinedWorkflowToggles(workflows) {
    if (!workflows) return;
    
    // Map of workflow IDs to checkbox IDs
    const workflowMap = {
        'contact-info': 'workflow-contact-info',
        'payment-notice': 'workflow-payment-notice',
        'payment-confirmation': 'workflow-payment-confirmation'
    };
    
    // Update each checkbox based on workflow status
    workflows.forEach(workflow => {
        const checkboxId = workflowMap[workflow.id];
        if (checkboxId) {
            const checkbox = document.getElementById(checkboxId);
            if (checkbox) {
                checkbox.checked = workflow.enabled;
            }
        }
    });
}

// Toggle workflow enabled/disabled state
function toggleWorkflow(workflowId, enabled) {
    fetch('/api/workflows/toggle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: workflowId,
            enabled: enabled
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const message = enabled ? 
                (window.i18n ? window.i18n.t('workflow.enabled') : 'enabled') : 
                (window.i18n ? window.i18n.t('workflow.disabled') : 'disabled');
            showToast(`Workflow ${message} successfully`, 'success');
            loadWorkflows(); // Refresh the list
        } else {
            showToast('Failed to update workflow: ' + data.error, 'error');
        }
    })
    .catch(error => {
        console.error('Error toggling workflow:', error);
        showToast('Failed to update workflow', 'error');
    });
}

// View workflow details
function viewWorkflowDetails(workflowId) {
    fetch(`/api/workflows/${workflowId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Display workflow details in a modal
                showWorkflowDetailsModal(data.workflow);
            } else {
                showToast('Failed to load workflow details: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Error loading workflow details:', error);
            showToast('Failed to load workflow details', 'error');
        });
}

// Show workflow details in a modal
function showWorkflowDetailsModal(workflow) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('workflow-details-modal');
    if (!modal) {
        const modalHtml = `
            <div class="modal fade" id="workflow-details-modal" tabindex="-1" aria-labelledby="workflowDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="workflowDetailsModalLabel">Workflow Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="workflow-details-content"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('workflow-details-modal');
    }
    
    // Update modal content
    const modalTitle = modal.querySelector('.modal-title');
    const modalContent = modal.querySelector('#workflow-details-content');
    
    modalTitle.textContent = workflow.name || 'Workflow Details';
    
    // Create content HTML
    let contentHtml = `
        <div class="mb-3">
            <h6>Description</h6>
            <p>${workflow.description || 'No description available'}</p>
        </div>
    `;
    
    // Add nodes information if available
    if (workflow.nodes && workflow.nodes.length > 0) {
        contentHtml += `
            <div class="mb-3">
                <h6>Nodes</h6>
                <ul class="list-group">
        `;
        
        workflow.nodes.forEach(node => {
            contentHtml += `
                <li class="list-group-item">
                    <strong>${node.type}</strong>
                    ${node.name ? ` - ${node.name}` : ''}
                </li>
            `;
        });
        
        contentHtml += `
                </ul>
            </div>
        `;
    }
    
    // Add JSON representation
    contentHtml += `
        <div class="mb-3">
            <h6>JSON Configuration</h6>
            <pre class="bg-light p-3 rounded"><code>${JSON.stringify(workflow.config || {}, null, 2)}</code></pre>
        </div>
    `;
    
    modalContent.innerHTML = contentHtml;
    
    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}
