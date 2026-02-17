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
    btn.textContent = 'Saving...';

    try {
        const response = await fetch('/api/training/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trainingData)
        });

        if (response.ok) {
            showStatus('Training data saved and applied successfully!', 'success');
        } else {
            const error = await response.json();
            showStatus('Failed to save data: ' + error.error, 'error');
        }
    } catch (error) {
        showStatus('Connection error. Failed to save.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save & Apply Changes';
    }
}

function showStatus(message, type) {
    const statusDiv = document.getElementById('saveStatus');
    statusDiv.textContent = message;
    statusDiv.className = 'status-message ' + type;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
