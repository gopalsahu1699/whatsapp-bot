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
        container.innerHTML = '<p style="color: var(--text-secondary);">No templates yet. Create your first template!</p>';
        return;
    }

    container.innerHTML = templates.map(template => `
        <div class="template-item">
            <div class="template-header">
                <div class="template-name">${escapeHtml(template.name)}</div>
                <div class="template-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editTemplate('${template.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTemplate('${template.id}')">Delete</button>
                </div>
            </div>
            <div class="template-message">${escapeHtml(template.message)}</div>
            ${template.imagePath ? `<img src="${template.imagePath}" class="template-image" alt="Template image">` : ''}
        </div>
    `).join('');
}

function showTemplateForm(editMode = false) {
    document.getElementById('templateForm').style.display = 'block';
    document.getElementById('formTitle').textContent = editMode ? 'Edit Template' : 'Add New Template';
    if (!editMode) {
        document.getElementById('templateFormElement').reset();
        document.getElementById('templateId').value = '';
        document.getElementById('currentImage').style.display = 'none';
    }
}

function hideTemplateForm() {
    document.getElementById('templateForm').style.display = 'none';
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
        document.getElementById('currentImage').style.display = 'block';
    } else {
        document.getElementById('currentImage').style.display = 'none';
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
