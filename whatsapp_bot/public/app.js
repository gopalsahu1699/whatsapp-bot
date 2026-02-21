// Global state

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
        const restartBotBtn = document.getElementById('restartBotBtn');

        if (data.connected) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500';
            statusText.textContent = 'Connected & Active';
            statusText.className = 'text-sm font-bold text-emerald-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
            restartBotBtn.classList.add('hidden');
        } else if (data.hasQR) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-amber-500';
            statusText.textContent = 'Action Required: Scan QR';
            statusText.className = 'text-sm font-bold text-amber-400';
            disconnectBtn.classList.add('hidden');
            restartBotBtn.classList.remove('hidden');
            await loadQRCode();
        } else {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-slate-500';
            statusText.textContent = 'Initializing...';
            statusText.className = 'text-sm font-bold text-slate-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.add('hidden');
            restartBotBtn.classList.remove('hidden');
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

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
