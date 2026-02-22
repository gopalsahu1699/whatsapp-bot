// Global state
let templates = [];

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

// Initialize templates page
async function init() {
    await checkAuth();
    setupEventListeners();
    await loadTemplates();
}

// Setup event listeners
function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Templates
    document.getElementById('addTemplateBtn').addEventListener('click', () => showTemplateForm());
    document.getElementById('templateFormElement').addEventListener('submit', saveTemplate);
    document.getElementById('removeImageBtn')?.addEventListener('click', removeCurrentImage);
    document.getElementById('templateType')?.addEventListener('change', handleTypeChange);
    document.getElementById('addPollOptionBtn')?.addEventListener('click', () => addPollOption());

    // Close modal on overlay click
    document.getElementById('modalOverlay')?.addEventListener('click', hideTemplateForm);
}

// ==================== AUTHENTICATION ====================

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}

// ==================== TEMPLATES ====================

async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        templates = await response.json();
        renderTemplates();
    } catch (error) {
        console.error('Failed to load templates:', error);
    }
}

function renderTemplates() {
    const container = document.getElementById('templatesList');

    if (templates.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center bg-dark-bg/20 rounded-2xl border border-dashed border-dark-border">
                <p class="text-slate-500 font-medium">No templates yet. Create your first template!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = templates.map(template => `
        <div class="glass border border-dark-border/40 rounded-2xl p-6 shadow-lg hover:border-primary/50 transition-all group animate-in fade-in zoom-in duration-300">
            <div class="flex justify-between items-start mb-4">
                <div class="template-name font-bold text-slate-100 group-hover:text-primary transition-colors truncate max-w-[150px] flex items-center gap-2 flex-wrap">
                    ${escapeHtml(template.name)}
                    ${template.type === 'poll' ? `<span class="px-2 py-0.5 text-[10px] uppercase font-bold bg-purple-500/20 text-purple-400 rounded-full border border-purple-500/20">Poll</span>` : `<span class="px-2 py-0.5 text-[10px] uppercase font-bold bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/20">Message</span>`}
                </div>
                <div class="flex gap-2">
                    <button onclick="editTemplate('${template._id}')" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="deleteTemplate('${template._id}')" class="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="template-message text-sm text-slate-400 mb-4 line-clamp-3 leading-relaxed">${escapeHtml(template.message)}</div>
            ${template.imagePath && template.type !== 'poll' ? `
                <div class="mt-4 rounded-xl overflow-hidden border border-dark-border/50 aspect-video bg-dark-bg/40">
                    <img src="${template.imagePath}" class="w-full h-full object-cover" alt="Template image">
                </div>
            ` : ''}
            ${template.type === 'poll' && template.pollOptions && template.pollOptions.length > 0 ? `
                <div class="mt-4 space-y-2">
                    ${template.pollOptions.map((opt, i) => `
                        <div class="flex items-center gap-3 p-2 bg-dark-bg/50 rounded-lg border border-dark-border/30 text-sm">
                            <span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">${i + 1}</span>
                            <span class="text-slate-300 truncate">${escapeHtml(opt)}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

function showTemplateForm(editMode = false) {
    const modal = document.getElementById('templateModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent scrolling

    document.getElementById('formTitle').textContent = editMode ? 'Edit Template Content' : 'Add New Campaign Template';
    if (!editMode) {
        document.getElementById('templateFormElement').reset();
        document.getElementById('templateId').value = '';
        document.getElementById('currentImage').classList.add('hidden');
        document.getElementById('templateType').value = 'text';
        handleTypeChange();
    }
}

function hideTemplateForm() {
    document.getElementById('templateModal').classList.add('hidden');
    document.body.style.overflow = 'auto'; // Restore scrolling
    document.getElementById('templateFormElement').reset();
}

async function saveTemplate(e) {
    e.preventDefault();

    const id = document.getElementById('templateId').value;
    const name = document.getElementById('templateName').value;
    const type = document.getElementById('templateType').value;
    const message = document.getElementById('templateMessage').value;
    const imageFile = document.getElementById('templateImage').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('type', type);
    formData.append('message', message);

    if (type === 'poll') {
        const optionInputs = document.querySelectorAll('.poll-option-input');
        const options = Array.from(optionInputs).map(input => input.value.trim()).filter(val => val !== '');
        if (options.length < 2) {
            alert('A poll must have at least 2 options.');
            return;
        }
        if (options.length > 12) {
            alert('A poll can have a maximum of 12 options.');
            return;
        }
        formData.append('pollOptions', JSON.stringify(options));
    }

    if (imageFile && type !== 'poll') {
        formData.append('image', imageFile);
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="flex items-center"><svg class="animate-spin -ml-1 mr-3 h-4 w-4 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Saving...</span>';

    try {
        const url = id ? `/api/templates/${id}` : '/api/templates';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            body: formData
        });

        if (response.ok) {
            hideTemplateForm();
            await loadTemplates();
        } else {
            let errorMsg = 'Unknown error';
            try {
                const errorData = await response.json();
                errorMsg = errorData.error || JSON.stringify(errorData);
            } catch (jsonErr) {
                errorMsg = await response.text();
            }
            alert('Failed to save template: ' + errorMsg);
        }
    } catch (error) {
        alert('Failed to save template: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function editTemplate(id) {
    const template = templates.find(t => t._id == id);
    if (!template) return;

    document.getElementById('templateId').value = template._id;
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateType').value = template.type || 'text';
    document.getElementById('templateMessage').value = template.message;

    handleTypeChange();

    if (template.type === 'poll' && template.pollOptions) {
        const list = document.getElementById('pollOptionsList');
        list.innerHTML = '';
        template.pollOptions.forEach(opt => addPollOption(opt));
    }

    if (template.imagePath) {
        document.getElementById('currentImagePreview').src = template.imagePath;
        document.getElementById('currentImage').classList.remove('hidden');
    } else {
        document.getElementById('currentImage').classList.add('hidden');
    }

    showTemplateForm(true);
}

async function deleteTemplate(id) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
        const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await loadTemplates();
        } else {
            alert('Failed to delete template');
        }
    } catch (error) {
        alert('Failed to delete template: ' + error.message);
    }
}

function removeCurrentImage() {
    document.getElementById('currentImage').style.display = 'none';
}

function handleTypeChange() {
    const type = document.getElementById('templateType').value;
    const pollOptionsSection = document.getElementById('pollOptionsSection');
    const templateImageSection = document.getElementById('templateImageSection');
    const messageLabel = document.getElementById('messageLabel');

    if (type === 'poll') {
        pollOptionsSection.classList.remove('hidden');
        templateImageSection.classList.add('hidden');
        messageLabel.textContent = 'Poll Question';

        // Ensure at least 2 options exist
        const list = document.getElementById('pollOptionsList');
        if (list.children.length < 2) {
            list.innerHTML = '';
            addPollOption('Yes');
            addPollOption('No');
        }
    } else {
        pollOptionsSection.classList.add('hidden');
        templateImageSection.classList.remove('hidden');
        messageLabel.textContent = 'Message Body (use {{placeholder}} for variables)';
    }
}

function addPollOption(value = '') {
    const list = document.getElementById('pollOptionsList');
    if (list.children.length >= 12) {
        alert('Maximum 12 options allowed');
        return;
    }

    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 group animate-in fade-in slide-in-from-left-2 duration-300';
    div.id = `option-${id}`;

    div.innerHTML = `
        <input type="text" class="poll-option-input flex-1 px-4 py-2 bg-dark-bg/60 border border-dark-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder-slate-600 text-slate-100 text-sm" placeholder="Option text..." value="${escapeHtml(value)}" required>
        <button type="button" onclick="removePollOption('${id}')" class="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
        </button>
    `;
    list.appendChild(div);
}

function removePollOption(id) {
    const list = document.getElementById('pollOptionsList');
    if (list.children.length <= 2) {
        alert('Minimum 2 options required for a poll');
        return;
    }
    const option = document.getElementById(`option-${id}`);
    if (option) {
        option.remove();
    }
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
