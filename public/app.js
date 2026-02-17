// Global state
let templates = [];
let uploadedContacts = [];
let bulkEventSource = null;

// Check authentication on load
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();

        if (!data.authenticated) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
}

// Initialize dashboard
async function init() {
    await checkAuth();
    setupEventListeners();
    await loadWhatsAppStatus();
    await loadTemplates();
    startStatusPolling();
}

// Setup event listeners
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // WhatsApp
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWhatsApp);

    // Bulk messaging
    document.getElementById('uploadCsvBtn').addEventListener('click', uploadCSV);
    document.getElementById('sendBulkBtn').addEventListener('click', sendBulkMessages);
    document.getElementById('cancelBulkBtn').addEventListener('click', cancelBulk);
    document.getElementById('bulkTemplateSelect').addEventListener('change', previewTemplate);
    document.getElementById('downloadSample').addEventListener('click', downloadSampleCSV);
}

// ==================== AUTHENTICATION ====================

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}

// ==================== WHATSAPP ====================

async function loadWhatsAppStatus() {
    try {
        const response = await fetch('/api/whatsapp/status');
        const data = await response.json();

        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        const qrContainer = document.getElementById('qrContainer');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (data.connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
            qrContainer.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
        } else if (data.hasQR) {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Not Connected - Scan QR Code';
            disconnectBtn.style.display = 'none';
            await loadQRCode();
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'Initializing...';
            qrContainer.style.display = 'none';
            disconnectBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load WhatsApp status:', error);
    }
}

async function loadQRCode() {
    try {
        const response = await fetch('/api/whatsapp/qr');
        const data = await response.json();

        if (data.qr) {
            document.getElementById('qrCode').src = data.qr;
            document.getElementById('qrContainer').style.display = 'block';
        }
    } catch (error) {
        console.error('Failed to load QR code:', error);
    }
}

async function disconnectWhatsApp() {
    if (!confirm('Are you sure you want to disconnect WhatsApp?')) return;

    try {
        await fetch('/api/whatsapp/disconnect', { method: 'POST' });
        await loadWhatsAppStatus();
    } catch (error) {
        alert('Failed to disconnect: ' + error.message);
    }
}

function startStatusPolling() {
    setInterval(loadWhatsAppStatus, 5000); // Check every 5 seconds
}

// ==================== TEMPLATES ====================

async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        templates = await response.json();
        updateTemplateSelect();
    } catch (error) {
        console.error('Failed to load templates:', error);
    }
}

function updateTemplateSelect() {
    const select = document.getElementById('bulkTemplateSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Select a template --</option>' +
        templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
}

// ==================== BULK MESSAGING ====================

async function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a CSV file');
        return;
    }

    const formData = new FormData();
    formData.append('csv', file);

    try {
        const response = await fetch('/api/bulk/upload-csv', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            uploadedContacts = data.contacts;
            const statusDiv = document.getElementById('csvStatus');
            statusDiv.className = 'status-message success';
            statusDiv.textContent = `✓ Uploaded ${data.count} contacts successfully`;
            statusDiv.style.display = 'block';
            updateSendButton();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        const statusDiv = document.getElementById('csvStatus');
        statusDiv.className = 'status-message error';
        statusDiv.textContent = '✗ Failed to upload CSV: ' + error.message;
        statusDiv.style.display = 'block';
    }
}

function previewTemplate() {
    const select = document.getElementById('bulkTemplateSelect');
    const templateId = select.value;
    const preview = document.getElementById('templatePreview');

    if (!templateId) {
        preview.style.display = 'none';
        updateSendButton();
        return;
    }

    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    preview.innerHTML = `
        <strong>Template: ${escapeHtml(template.name)}</strong><br>
        <div style="margin-top: 10px; color: var(--text-secondary);">${escapeHtml(template.message)}</div>
        ${template.imagePath ? '<div style="margin-top: 10px; color: var(--text-secondary);">📷 Includes image</div>' : ''}
    `;
    preview.style.display = 'block';
    updateSendButton();
}

function updateSendButton() {
    const btn = document.getElementById('sendBulkBtn');
    const templateId = document.getElementById('bulkTemplateSelect').value;
    btn.disabled = !(uploadedContacts.length > 0 && templateId);
}

async function sendBulkMessages() {
    const templateId = document.getElementById('bulkTemplateSelect').value;

    if (!confirm(`Send messages to ${uploadedContacts.length} contacts?`)) return;

    document.getElementById('sendBulkBtn').style.display = 'none';
    document.getElementById('cancelBulkBtn').style.display = 'inline-block';
    document.getElementById('bulkProgress').style.display = 'block';

    try {
        const response = await fetch('/api/bulk/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: uploadedContacts, templateId })
        });

        if (!response.ok) {
            throw new Error('Failed to start bulk send');
        }

        // Setup EventSource for progress updates
        bulkEventSource = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await bulkEventSource.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    updateProgress(data);

                    if (data.complete) {
                        completeBulkSend(data);
                        return;
                    }
                }
            }
        }
    } catch (error) {
        alert('Failed to send messages: ' + error.message);
        resetBulkUI();
    }
}

function updateProgress(data) {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    const details = document.getElementById('progressDetails');

    fill.style.width = data.percentage + '%';
    text.textContent = data.percentage + '%';
    details.textContent = `Sent: ${data.sent} | Failed: ${data.failed} | Total: ${data.total}`;

    if (data.current) {
        details.textContent += ` | Current: ${data.current}`;
    }
}

function completeBulkSend(data) {
    alert(`Bulk send complete!\nSent: ${data.sent}\nFailed: ${data.failed}`);
    resetBulkUI();
}

function cancelBulk() {
    if (bulkEventSource) {
        bulkEventSource.cancel();
    }
    resetBulkUI();
}

function resetBulkUI() {
    document.getElementById('sendBulkBtn').style.display = 'inline-block';
    document.getElementById('cancelBulkBtn').style.display = 'none';
    document.getElementById('bulkProgress').style.display = 'none';
    document.getElementById('progressFill').style.width = '0%';
}

function downloadSampleCSV(e) {
    e.preventDefault();
    const csv = 'name,phone,custom1\nJohn Doe,+919876543210,value1\nJane Smith,+919876543211,value2';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-contacts.csv';
    a.click();
}

// ==================== UTILITIES ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
