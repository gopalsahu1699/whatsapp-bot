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

// Initialize training page
async function init() {
    await checkAuth();
    setupEventListeners();
    await loadTrainingData();
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('saveTrainingBtn').addEventListener('click', saveTrainingData);
    document.getElementById('resetTrainingBtn').addEventListener('click', loadTrainingData);
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/login.html';
}

async function loadTrainingData() {
    try {
        const response = await fetch('/api/training/data');
        const data = await response.json();

        // Map JSON keys to textarea IDs
        document.getElementById('aboutUs').value = data.aboutUs || '';
        document.getElementById('products').value = data.products || '';
        document.getElementById('faq').value = data.faq || '';
        document.getElementById('refundPolicy').value = data.refundPolicy || '';
        document.getElementById('contact').value = data.contact || '';

        showStatus('Data loaded successfully', 'success');
    } catch (error) {
        console.error('Failed to load training data:', error);
        showStatus('Failed to load data', 'error');
    }
}

async function saveTrainingData() {
    const btn = document.getElementById('saveTrainingBtn');

    // Construct JSON object from all fields
    const trainingData = {
        aboutUs: document.getElementById('aboutUs').value,
        products: document.getElementById('products').value,
        faq: document.getElementById('faq').value,
        refundPolicy: document.getElementById('refundPolicy').value,
        contact: document.getElementById('contact').value
    };

    btn.disabled = true;
    const originalText = btn.textContent;
    btn.innerHTML = '<span class="flex items-center justify-center"><svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Applying to AI...</span>';

    try {
        const response = await fetch('/api/training/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trainingData)
        });

        if (response.ok) {
            showStatus('Intelligence updated! The bot is now smarter.', 'success');
        } else {
            const error = await response.json();
            showStatus('Failed to update AI: ' + error.error, 'error');
        }
    } catch (error) {
        showStatus('Connection failed. Could not sync with AI model.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('saveStatus');
    statusDiv.textContent = message;

    if (type === 'success') {
        statusDiv.className = 'my-8 p-4 rounded-xl text-center font-bold text-xs uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 animate-in fade-in duration-300';
    } else {
        statusDiv.className = 'my-8 p-4 rounded-xl text-center font-bold text-xs uppercase tracking-widest bg-red-500/10 border border-red-500/30 text-red-500 animate-in fade-in duration-300';
    }

    statusDiv.classList.remove('hidden');

    setTimeout(() => {
        statusDiv.classList.add('hidden');
    }, 5000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
