document.addEventListener('DOMContentLoaded', () => {
    // Check Auth
    fetch('/api/check-auth')
        .then(res => res.json())
        .then(data => {
            if (!data.authenticated) {
                window.location.href = 'login.html';
            } else {
                loadLists();
            }
        })
        .catch(() => {
            window.location.href = 'login.html';
        });
});

let currentLists = [];
let currentContacts = [];
let activeListId = null;

// ==================== LISTS VIEW ====================

async function loadLists() {
    const tableBody = document.getElementById('listsTableBody');
    const loading = document.getElementById('tableLoading');
    const empty = document.getElementById('tableEmpty');
    const listsSection = document.getElementById('listsSection');
    const detailsSection = document.getElementById('detailsSection');

    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    listsSection.classList.remove('hidden');
    detailsSection.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        const response = await fetch('/api/contact-lists');
        if (!response.ok) throw new Error('Failed to fetch lists');
        currentLists = await response.json();

        if (currentLists.length === 0) {
            empty.classList.remove('hidden');
        } else {
            renderLists(currentLists);
        }
    } catch (error) {
        console.error('Error fetching lists:', error);
        alert('Failed to load contact lists');
    } finally {
        loading.classList.add('hidden');
    }
}

function renderLists(lists) {
    const tableBody = document.getElementById('listsTableBody');
    tableBody.innerHTML = '';

    lists.forEach(list => {
        const lastUsed = list.lastUsedAt ? new Date(list.lastUsedAt).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Never';

        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition-colors group cursor-pointer';
        tr.onclick = (e) => {
            if (!e.target.closest('button')) viewList(list._id);
        };

        tr.innerHTML = `
            <td class="p-4 border-b border-dark-border">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xl shadow-inner">
                        📄
                    </div>
                    <div>
                        <span class="font-bold text-slate-200 block">${list.name}</span>
                        <span class="text-xs text-slate-500 uppercase tracking-tight">${list.filename || 'Manual List'}</span>
                    </div>
                </div>
            </td>
            <td class="p-4 border-b border-dark-border text-center">
                <span class="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-bold border border-indigo-500/20">
                    ${list.contactCount} contacts
                </span>
            </td>
            <td class="p-4 border-b border-dark-border text-slate-400 text-xs tabular-nums">${lastUsed}</td>
            <td class="p-4 border-b border-dark-border text-center">
                <span class="text-slate-300 font-mono text-sm">${list.usageCount || 0}</span>
            </td>
            <td class="p-4 border-b border-dark-border text-right">
                <div class="flex justify-end gap-2">
                    <button onclick="viewList('${list._id}')" class="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-indigo-400" title="View Contacts">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
                        </svg>
                    </button>
                    <button onclick="deleteList('${list._id}')" class="p-2 bg-slate-700/50 hover:bg-red-500/20 rounded-lg transition-colors text-red-400" title="Delete List">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==================== LIST DETAILS VIEW ====================

async function viewList(id) {
    const listsSection = document.getElementById('listsSection');
    const detailsSection = document.getElementById('detailsSection');
    const tableBody = document.getElementById('contactsTableBody');
    const loading = document.getElementById('tableLoading');

    activeListId = id;
    loading.classList.remove('hidden');
    listsSection.classList.add('hidden');
    detailsSection.classList.remove('hidden');

    try {
        const response = await fetch(`/api/contact-lists/${id}`);
        if (!response.ok) throw new Error('Failed to fetch list details');
        const data = await response.json();

        document.getElementById('detailListName').innerText = data.list.name;
        const date = new Date(data.list.createdAt).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric'
        });
        document.getElementById('detailListMeta').innerText = `${data.contacts.length} contacts • ${date}`;

        renderContacts(data.contacts);
    } catch (error) {
        console.error('Error viewing list:', error);
        alert('Failed to load contacts');
        showLists();
    } finally {
        loading.classList.add('hidden');
    }
}

function showLists() {
    loadLists();
}

function renderContacts(contacts) {
    const tableBody = document.getElementById('contactsTableBody');
    tableBody.innerHTML = '';

    contacts.forEach(contact => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/30 transition-colors group';
        tr.innerHTML = `
            <td class="p-4 border-b border-dark-border">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                        ${contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span class="font-medium">${contact.name || 'Unknown'}</span>
                </div>
            </td>
            <td class="p-4 border-b border-dark-border text-slate-300 tabular-nums">${contact.phone}</td>
            <td class="p-4 border-b border-dark-border text-right">
                <button onclick="deleteContact('${contact._id}')" class="p-2 opacity-0 group-hover:opacity-100 bg-slate-700/50 hover:bg-red-500/20 rounded-lg transition-all text-red-400" title="Remove">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                </button>
            </td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==================== ACTIONS ====================

async function handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('csv', file);

    const loading = document.getElementById('tableLoading');
    loading.classList.remove('hidden');

    try {
        const response = await fetch('/api/bulk/upload-csv', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }

        const data = await response.json();
        alert(`Successfully uploaded "${data.listName}" with ${data.count} contacts.`);
        loadLists();
    } catch (error) {
        console.error('Upload error:', error);
        alert('Error uploading CSV: ' + error.message);
    } finally {
        loading.classList.add('hidden');
        event.target.value = ''; // Reset input
    }
}

async function deleteList(id) {
    if (!confirm('Are you sure you want to delete this entire list and all its contacts?')) return;

    try {
        const response = await fetch(`/api/contact-lists/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete list');
        loadLists();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteContact(id) {
    if (!confirm('Remove this contact?')) return;
    try {
        const response = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete');
        viewList(activeListId);
    } catch (error) {
        alert(error.message);
    }
}

// ==================== MODAL LOGIC (Manual Add) ====================

function openModal() {
    const modal = document.getElementById('contactModal');
    document.getElementById('contactId').value = '';
    document.getElementById('contactName').value = '';
    document.getElementById('contactPhone').value = '';
    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('contactModal').classList.add('hidden');
}

async function saveContact() {
    const name = document.getElementById('contactName').value.trim();
    const phone = document.getElementById('contactPhone').value.trim();

    if (!name || !phone) {
        alert("Please provide both a name and a phone number.");
        return;
    }

    try {
        const response = await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });

        if (!response.ok) throw new Error('Failed to save contact');

        closeModal();
        if (activeListId) viewList(activeListId);
        else loadLists();

    } catch (error) {
        alert(error.message);
    }
}
