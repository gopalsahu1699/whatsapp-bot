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
    document.getElementById('restartBotBtn').addEventListener('click', restartWhatsApp);
    document.getElementById('regenQrBtn').addEventListener('click', restartWhatsApp);

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
        const statusDotFixed = document.getElementById('statusDotFixed');
        const statusText = document.getElementById('statusText');
        const qrContainer = document.getElementById('qrContainer');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (data.connected) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500';
            statusText.textContent = 'Connected & Active';
            statusText.className = 'text-sm font-bold text-emerald-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
        } else if (data.hasQR) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-red-500';
            statusText.textContent = 'Action Required: Scan QR';
            statusText.className = 'text-sm font-bold text-red-400';
            disconnectBtn.classList.add('hidden');
            await loadQRCode();
        } else {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-slate-500';
            statusText.textContent = 'Initializing...';
            statusText.className = 'text-sm font-bold text-slate-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.add('hidden');
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
            document.getElementById('qrContainer').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load QR code:', error);
    }
}

async function restartWhatsApp() {
    const btn = document.getElementById('restartBotBtn');
    const regenBtn = document.getElementById('regenQrBtn');
    const originalText = btn.textContent;

    if (!confirm('This will restart the WhatsApp connection. Continue?')) return;

    try {
        btn.disabled = true;
        regenBtn.disabled = true;
        btn.textContent = 'Restarting...';

        const response = await fetch('/api/whatsapp/restart', { method: 'POST' });
        const data = await response.json();

        if (data.success) {
            // Force status check
            await loadWhatsAppStatus();
        } else {
            throw new Error(data.error || 'Failed to restart');
        }
    } catch (error) {
        alert('Restart failed: ' + error.message);
    } finally {
        btn.disabled = false;
        regenBtn.disabled = false;
        btn.textContent = originalText;
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
        templates.map(t => `<option value="${t._id}">${escapeHtml(t.name)}</option>`).join('');
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

    const btn = document.getElementById('uploadCsvBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';

    try {
        const response = await fetch('/api/bulk/upload-csv', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            uploadedContacts = data.contacts;
            const statusDiv = document.getElementById('csvStatus');
            statusDiv.className = 'p-4 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in slide-in-from-top duration-300';
            statusDiv.textContent = `✓ Successfully parsed ${data.count} contacts.`;
            statusDiv.classList.remove('hidden');
            updateSendButton();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        const statusDiv = document.getElementById('csvStatus');
        statusDiv.className = 'p-4 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-500 animate-in slide-in-from-top duration-300';
        statusDiv.textContent = '✗ Error: ' + error.message;
        statusDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
    }
}

function previewTemplate() {
    const select = document.getElementById('bulkTemplateSelect');
    const templateId = select.value;
    const preview = document.getElementById('templatePreview');

    if (!templateId) {
        preview.classList.add('hidden');
        updateSendButton();
        return;
    }

    const template = templates.find(t => t._id === templateId);
    if (!template) return;

    preview.innerHTML = `
        <div class="font-bold text-indigo-400 mb-2 uppercase tracking-tight text-[10px]">Active Template: ${escapeHtml(template.name)}</div>
        <div class="text-slate-300 leading-relaxed">${escapeHtml(template.message)}</div>
        ${template.imagePath ? '<div class="mt-3 inline-flex items-center px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-md text-[10px] uppercase font-bold tracking-widest"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Attachment Included</div>' : ''}
    `;
    preview.classList.remove('hidden');
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

    document.getElementById('sendBulkBtn').classList.add('hidden');
    document.getElementById('cancelBulkBtn').classList.remove('hidden');
    document.getElementById('bulkProgress').classList.remove('hidden');

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
    details.textContent = `Completed: ${data.sent} | Issues: ${data.failed} | Total: ${data.total}`;

    if (data.current) {
        details.textContent += ` | Processing: ${data.current}`;
    }
}

function completeBulkSend(data) {
    alert(`Campaign Finished!\nSuccessfully Sent: ${data.sent}\nFailed/Errors: ${data.failed}`);
    resetBulkUI();
}

function cancelBulk() {
    if (bulkEventSource) {
        bulkEventSource.cancel();
    }
    resetBulkUI();
}

function resetBulkUI() {
    document.getElementById('sendBulkBtn').classList.remove('hidden');
    document.getElementById('cancelBulkBtn').classList.add('hidden');
    document.getElementById('bulkProgress').classList.add('hidden');
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
