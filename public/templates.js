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
    document.getElementById('addTemplateBtn').addEventListener('click', showTemplateForm);
    document.getElementById('cancelTemplateBtn').addEventListener('click', hideTemplateForm);
    document.getElementById('templateFormElement').addEventListener('submit', saveTemplate);
    document.getElementById('removeImageBtn')?.addEventListener('click', removeCurrentImage);
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
                <div class="template-name font-bold text-slate-100 group-hover:text-primary transition-colors truncate max-w-[150px]">${escapeHtml(template.name)}</div>
                <div class="flex gap-2">
                    <button onclick="editTemplate('${template.id}')" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="deleteTemplate('${template.id}')" class="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="template-message text-sm text-slate-400 mb-4 line-clamp-3 leading-relaxed">${escapeHtml(template.message)}</div>
            ${template.imagePath ? `
                <div class="mt-4 rounded-xl overflow-hidden border border-dark-border/50 aspect-video bg-dark-bg/40">
                    <img src="${template.imagePath}" class="w-full h-full object-cover" alt="Template image">
                </div>
            ` : ''}
        </div>
    `).join('');
}

function showTemplateForm(editMode = false) {
    const formDiv = document.getElementById('templateForm');
    formDiv.classList.remove('hidden');
    document.getElementById('formTitle').textContent = editMode ? 'Edit Template Content' : 'Add New Campaign Template';
    if (!editMode) {
        document.getElementById('templateFormElement').reset();
        document.getElementById('templateId').value = '';
        document.getElementById('currentImage').classList.add('hidden');
    }
}

function hideTemplateForm() {
    document.getElementById('templateForm').classList.add('hidden');
    document.getElementById('templateFormElement').reset();
}

async function saveTemplate(e) {
    e.preventDefault();

    const id = document.getElementById('templateId').value;
    const name = document.getElementById('templateName').value;
    const message = document.getElementById('templateMessage').value;
    const imageFile = document.getElementById('templateImage').files[0];

    const formData = new FormData();
    formData.append('name', name);
    formData.append('message', message);
    if (imageFile) {
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
            const error = await response.json();
            alert('Failed to save template: ' + error.error);
        }
    } catch (error) {
        alert('Failed to save template: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function editTemplate(id) {
    const template = templates.find(t => t.id === id);
    if (!template) return;

    document.getElementById('templateId').value = template.id;
    document.getElementById('templateName').value = template.name;
    document.getElementById('templateMessage').value = template.message;

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
