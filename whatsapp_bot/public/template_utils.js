// Utility functions for template handling shared between pages

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

function removeCurrentImage() {
    const currentImageDiv = document.getElementById('currentImage');
    if (currentImageDiv) {
        currentImageDiv.classList.add('hidden');
    }
}
