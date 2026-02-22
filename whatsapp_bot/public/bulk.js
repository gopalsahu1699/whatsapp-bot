let templates = [];
let uploadedContacts = [];
let contactLists = [];
let selectedListId = null;
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

// Initialize page
async function init() {
    await checkAuth();
    setupEventListeners();
    await loadWhatsAppStatus();
    await loadTemplates();
    startStatusPolling();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('uploadCsvBtn').addEventListener('click', uploadCSV);
    document.getElementById('sendBulkBtn').addEventListener('click', sendBulkMessages);
    document.getElementById('cancelBulkBtn').addEventListener('click', cancelBulk);
    document.getElementById('bulkTemplateSelect').addEventListener('change', previewTemplate);
    document.getElementById('downloadSample').addEventListener('click', downloadSampleCSV);

    // Tab Events
    document.getElementById('tabCsv').addEventListener('click', () => switchTab('csv'));
    document.getElementById('tabCrm').addEventListener('click', () => switchTab('crm'));
    document.getElementById('confirmCrmBtn').addEventListener('click', confirmListSelection);

    // QR related
    document.getElementById('regenQrBtn').addEventListener('click', restartWhatsApp);
}

// ==================== AUTH & WHATSAPP STATUS ====================

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}

async function loadWhatsAppStatus() {
    try {
        const response = await fetch('/api/whatsapp/status');
        const data = await response.json();
        const statusDot = document.getElementById('statusDot');
        const statusDotFixed = document.getElementById('statusDotFixed');
        const statusText = document.getElementById('statusText');
        const connectionIndicator = document.getElementById('connectionIndicator');
        const qrModal = document.getElementById('qrModal');

        connectionIndicator.classList.remove('hidden');

        if (data.connected) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-2 w-2 bg-emerald-500';
            statusText.textContent = 'Active';
            statusText.className = 'text-[10px] font-bold text-emerald-400 uppercase tracking-tight';
            qrModal.classList.add('hidden');
        } else if (data.hasQR) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-2 w-2 bg-amber-500';
            statusText.textContent = 'Action Required';
            statusText.className = 'text-[10px] font-bold text-amber-400 uppercase tracking-tight';
            if (!bulkEventSource) {
                await loadQRCode();
                qrModal.classList.remove('hidden');
            }
        } else {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-2 w-2 bg-slate-500';
            statusText.textContent = 'Connecting...';
            statusText.className = 'text-[10px] font-bold text-slate-400 uppercase tracking-tight';
        }
    } catch (error) {
        console.error('Failed to load WhatsApp status:', error);
    }
}

async function loadQRCode() {
    try {
        const response = await fetch('/api/whatsapp/qr');
        const data = await response.json();
        if (data.qr) document.getElementById('qrCode').src = data.qr;
    } catch (error) {
        console.error('Failed to load QR code:', error);
    }
}

async function restartWhatsApp() {
    const btn = document.getElementById('regenQrBtn');
    const originalText = btn.textContent;
    try {
        btn.disabled = true;
        btn.textContent = 'Restarting...';
        const response = await fetch('/api/whatsapp/restart', { method: 'POST' });
        const data = await response.json();
        if (data.success) await loadWhatsAppStatus();
        else throw new Error(data.error || 'Failed to restart');
    } catch (error) {
        alert('Restart failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function startStatusPolling() {
    setInterval(loadWhatsAppStatus, 5000);
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

// ==================== BULK MESSAGING ====================

async function uploadCSV() {
    const fileInput = document.getElementById('csvFile');
    const file = fileInput.files[0];
    if (!file) { alert('Please select a CSV file'); return; }

    const formData = new FormData();
    formData.append('csv', file);

    const btn = document.getElementById('uploadCsvBtn');
    btn.disabled = true;
    btn.textContent = 'Processing...';

    try {
        const response = await fetch('/api/bulk/upload-csv', { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            uploadedContacts = data.contacts;
            const statusDiv = document.getElementById('csvStatus');
            statusDiv.className = 'p-4 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in slide-in-from-top duration-300';
            statusDiv.innerHTML = `✓ Successfully parsed & saved ${data.count} contacts. Ready to launch.`;
            statusDiv.classList.remove('hidden');
            logCampaign(`System: File parsed & saved. Found ${data.count} contacts.`);
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

function updateSendButton() {
    const btn = document.getElementById('sendBulkBtn');
    const templateId = document.getElementById('bulkTemplateSelect').value;
    btn.disabled = !(uploadedContacts.length > 0 && templateId);
}

// ==================== CRM SELECTION LOGIC ====================

function switchTab(tab) {
    const tabCsv = document.getElementById('tabCsv');
    const tabCrm = document.getElementById('tabCrm');
    const csvArea = document.getElementById('csvArea');
    const crmArea = document.getElementById('crmArea');

    if (tab === 'csv') {
        tabCsv.classList.replace('text-slate-500', 'text-indigo-400');
        tabCsv.classList.replace('border-transparent', 'border-indigo-500');
        tabCrm.classList.replace('text-indigo-400', 'text-slate-500');
        tabCrm.classList.replace('border-indigo-500', 'border-transparent');
        csvArea.classList.remove('hidden');
        crmArea.classList.add('hidden');
    } else {
        tabCrm.classList.replace('text-slate-500', 'text-indigo-400');
        tabCrm.classList.replace('border-transparent', 'border-indigo-500');
        tabCsv.classList.replace('text-indigo-400', 'text-slate-500');
        tabCsv.classList.replace('border-indigo-500', 'border-transparent');
        csvArea.classList.add('hidden');
        crmArea.classList.remove('hidden');
        loadCrmLists();
    }
}

async function loadCrmLists() {
    const modalContainer = document.getElementById('modalListsList');
    try {
        const response = await fetch('/api/contact-lists');
        if (!response.ok) throw new Error('Failed to fetch lists');
        contactLists = await response.json();

        if (contactLists.length === 0) {
            modalContainer.innerHTML = '<div class="p-8 text-center text-slate-500 text-xs italic border border-dashed border-dark-border rounded-2xl">No saved CSV lists found. Upload one to get started.</div>';
            return;
        }

        renderModalLists(contactLists);
    } catch (error) {
        console.error(error);
        modalContainer.innerHTML = '<div class="p-4 text-center text-red-400 text-xs">Failed to load lists.</div>';
    }
}

function renderModalLists(lists) {
    const container = document.getElementById('modalListsList');
    container.innerHTML = '';

    if (lists.length === 0) {
        container.innerHTML = '<div class="p-8 text-center text-slate-500 text-sm italic">No matching lists found.</div>';
        return;
    }

    lists.forEach(list => {
        const isSelected = selectedListId === list._id;
        const div = document.createElement('div');
        div.className = `p-4 border rounded-2xl cursor-pointer transition-all ${isSelected ? 'bg-indigo-500/10 border-indigo-500 shadow-lg' : 'bg-slate-900/30 border-dark-border hover:bg-slate-800/50'}`;
        div.onclick = () => selectList(list._id);

        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl shadow-inner">📄</div>
                    <div>
                        <p class="text-sm font-bold text-slate-200">${escapeHtml(list.name)}</p>
                        <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">${list.contactCount} contacts • ${new Date(list.createdAt).toLocaleDateString('en-IN')}</p>
                    </div>
                </div>
                ${isSelected ? '<div class="text-indigo-400"><svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg></div>' : '<div class="text-slate-700"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>'}
            </div>
        `;
        container.appendChild(div);
    });
}

function selectList(id) {
    selectedListId = id;
    const list = contactLists.find(l => l._id === id);
    if (!list) return;

    // Update main UI selection status
    const crmArea = document.getElementById('crmArea');
    const placeholders = crmArea.querySelectorAll('.text-slate-400, .text-slate-200, .text-slate-500');

    // Update the "Target a Saved List" section to show selection
    const innerContainer = crmArea.querySelector('.flex.flex-col.items-center');
    innerContainer.innerHTML = `
        <div class="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-inner">✅</div>
        <h4 class="text-indigo-400 font-bold mb-1">List Selected: ${escapeHtml(list.name)}</h4>
        <p class="text-slate-500 text-xs mb-6 text-center max-w-[250px]">Contains ${list.contactCount} contacts. Press confirm to prepare campaign.</p>
        <button onclick="openListModal()" class="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-dark-border transition-all flex items-center gap-2 text-xs">
            Change List
        </button>
    `;

    document.getElementById('crmSelectedCount').textContent = `Ready: ${list.name} (${list.contactCount} contacts)`;
    document.getElementById('confirmCrmBtn').disabled = false;

    closeListModal();
}

function openListModal() {
    const modal = document.getElementById('listModal');
    modal.classList.remove('hidden');
    document.getElementById('listSearch').value = '';
    loadCrmLists();
}

function closeListModal() {
    document.getElementById('listModal').classList.add('hidden');
}

function handleListSearch(event) {
    const query = event.target.value.toLowerCase();
    const filtered = contactLists.filter(l =>
        l.name.toLowerCase().includes(query) ||
        (l.filename && l.filename.toLowerCase().includes(query))
    );
    renderModalLists(filtered);
}

async function confirmListSelection() {
    if (!selectedListId) return;

    const btn = document.getElementById('confirmCrmBtn');
    btn.disabled = true;
    btn.textContent = 'Loading List...';

    try {
        const response = await fetch(`/api/contact-lists/${selectedListId}`);
        const data = await response.json();

        if (response.ok) {
            uploadedContacts = data.contacts;
            const statusDiv = document.getElementById('crmStatus');
            statusDiv.className = 'mt-4 p-4 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in slide-in-from-top duration-300';
            statusDiv.innerHTML = `✓ Successfully loaded "${data.list.name}" (${data.contacts.length} contacts). Ready to launch.`;
            statusDiv.classList.remove('hidden');
            document.getElementById('csvStatus').classList.add('hidden');
            logCampaign(`System: List "${data.list.name}" loaded with ${data.contacts.length} contacts.`);
            updateSendButton();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        alert('Failed to load list details: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Confirm List';
    }
}

// ==================== CAMPAIGN EXECUTION ====================

async function sendBulkMessages() {
    const templateId = document.getElementById('bulkTemplateSelect').value;
    const delay = document.getElementById('bulkDelaySelect').value;
    if (!confirm(`Launch campaign to ${uploadedContacts.length} contacts?`)) return;

    document.getElementById('sendBulkBtn').classList.add('hidden');
    document.getElementById('cancelBulkBtn').classList.remove('hidden');
    document.getElementById('bulkProgress').classList.remove('hidden');
    document.getElementById('campaignBadge').textContent = 'Campaign In Progress';
    document.getElementById('campaignBadge').className = 'text-[10px] bg-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20 font-bold uppercase tracking-widest';

    logCampaign(`Campaign: Starting with ${delay}s delay...`);

    try {
        const response = await fetch('/api/bulk/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts: uploadedContacts, templateId, delay, listId: selectedListId })
        });

        if (!response.ok) throw new Error('Failed to start bulk send');

        const reader = response.body.getReader();
        bulkEventSource = reader;
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));
                    updateProgress(data);
                    if (data.complete) { completeBulkSend(data); return; }
                    if (data.error) logCampaign(`Error: ${data.error}`, true);
                    else if (data.current) logCampaign(`Sent: ${data.current}`);
                }
            }
        }
    } catch (error) {
        logCampaign(`Fatal Error: ${error.message}`, true);
        alert('Failed to send messages: ' + error.message);
        resetBulkUI();
    }
}

function updateProgress(data) {
    const fill = document.getElementById('progressFill');
    const text = document.getElementById('progressText');
    const details = document.getElementById('progressDetails');
    const currentProcess = document.getElementById('currentProcess');

    fill.style.width = data.percentage + '%';
    text.textContent = data.percentage + '%';
    details.textContent = `Queue: ${data.total} | Sent: ${data.sent} | Issues: ${data.failed}`;
    if (data.current) currentProcess.textContent = `Processing: ${data.current}`;
}

function logCampaign(message, isError = false) {
    const logContainer = document.getElementById('logContainer');
    const div = document.createElement('div');
    if (isError) div.className = 'text-red-400';
    div.textContent = `> ${new Date().toLocaleTimeString()}: ${message}`;
    logContainer.appendChild(div);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function completeBulkSend(data) {
    logCampaign(`Campaign: Finished. Total successful: ${data.sent}, Failed: ${data.failed}`);
    setTimeout(() => {
        alert(`Campaign Finished!\nSuccessfully Sent: ${data.sent}\nFailed/Errors: ${data.failed}`);
        resetBulkUI();
    }, 500);
}

function cancelBulk() {
    if (confirm('Are you sure you want to stop the campaign?')) {
        if (bulkEventSource) { bulkEventSource.cancel(); bulkEventSource = null; }
        logCampaign(`Campaign: Aborted by user.`, true);
        resetBulkUI();
    }
}

function resetBulkUI() {
    document.getElementById('sendBulkBtn').classList.remove('hidden');
    document.getElementById('cancelBulkBtn').classList.add('hidden');
    document.getElementById('bulkProgress').classList.add('hidden');
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('campaignBadge').textContent = 'Ready to blast';
    document.getElementById('campaignBadge').className = 'text-[10px] bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full border border-indigo-500/20 font-bold uppercase tracking-widest italic';
    bulkEventSource = null;
}

function downloadSampleCSV(e) {
    e.preventDefault();
    const headers = 'name,phone,custom1,custom2\n';
    const sample = 'John Doe,919876543210,CustomValue1,CustomValue2\nJane Smith,918765432109,AnotherValue,';
    const blob = new Blob([headers + sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autommensor-contacts-sample.csv';
    a.click();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
