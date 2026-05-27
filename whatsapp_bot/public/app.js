// Global state

// Initialize dashboard
async function init() {
    setupEventListeners();
    await loadWhatsAppStatus();
    await loadAIStatus();
    startStatusPolling();
}

// Setup event listeners
function setupEventListeners() {
    // WhatsApp controls
    document.getElementById('startBotBtn').addEventListener('click', startBot);
    document.getElementById('stopBotBtn').addEventListener('click', stopBot);

    // WhatsApp
    document.getElementById('disconnectBtn').addEventListener('click', disconnectWhatsApp);
    document.getElementById('restartBotBtn').addEventListener('click', restartWhatsApp);
    document.getElementById('regenQrBtn').addEventListener('click', restartWhatsApp);



    // WhatsApp AI Auto-Responder controls
    document.getElementById('toggleAiBtn').addEventListener('click', toggleAIResponder);

    // hide start/stop initially
    document.getElementById('startBotBtn').classList.add('hidden');
    document.getElementById('stopBotBtn').classList.add('hidden');
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
        const regenQrBtn = document.getElementById('regenQrBtn');

        if (data.connected) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500';
            statusText.textContent = 'Connected & Active';
            statusText.className = 'text-sm font-bold text-emerald-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.remove('hidden');
            restartBotBtn.classList.add('hidden');
            regenQrBtn.classList.add('hidden');
            // Show stop button when connected
            document.getElementById('stopBotBtn').classList.remove('hidden');
            document.getElementById('startBotBtn').classList.add('hidden');
        } else if (data.hasQR) {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-amber-500';
            statusText.textContent = 'Action Required: Scan QR';
            statusText.className = 'text-sm font-bold text-amber-400';
            disconnectBtn.classList.add('hidden');
            restartBotBtn.classList.add('hidden');
            regenQrBtn.classList.remove('hidden');
            document.getElementById('startBotBtn').classList.add('hidden');
            document.getElementById('stopBotBtn').classList.add('hidden');
            await loadQRCode();
        } else {
            statusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75';
            statusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-slate-500';
            statusText.textContent = 'Disconnected';
            statusText.className = 'text-sm font-bold text-slate-400';
            qrContainer.classList.add('hidden');
            disconnectBtn.classList.add('hidden');
            restartBotBtn.classList.remove('hidden');
            regenQrBtn.classList.add('hidden');
            // Show start button when stopped
            document.getElementById('startBotBtn').classList.remove('hidden');
            document.getElementById('stopBotBtn').classList.add('hidden');
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

async function startBot() {
    const btn = document.getElementById('startBotBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Starting...';
    try {
        const response = await fetch('/api/whatsapp/start', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadWhatsAppStatus();
        } else {
            throw new Error(data.error || 'Failed to start');
        }
    } catch (error) {
        alert('Start failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function stopBot() {
    const btn = document.getElementById('stopBotBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Stopping...';
    try {
        const response = await fetch('/api/whatsapp/stop', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadWhatsAppStatus();
        } else {
            throw new Error(data.error || 'Failed to stop');
        }
    } catch (error) {
        alert('Stop failed: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function restartWhatsApp() {
    try {
        const response = await fetch('/api/whatsapp/restart', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadWhatsAppStatus();
        } else {
            alert('Restart failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Restart failed: ' + error.message);
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
    setInterval(() => {
        loadWhatsAppStatus();
        loadAIStatus();
    }, 5000); // Check every 5 seconds
}

async function loadAIStatus() {
    try {
        const response = await fetch('/api/whatsapp/ai-status');
        const data = await response.json();

        const aiStatusDot = document.getElementById('aiStatusDot');
        const aiStatusDotFixed = document.getElementById('aiStatusDotFixed');
        const aiStatusText = document.getElementById('aiStatusText');
        const toggleAiBtn = document.getElementById('toggleAiBtn');

        if (data.enabled) {
            aiStatusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75';
            aiStatusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-emerald-500';
            aiStatusText.textContent = 'Active & Responding';
            aiStatusText.className = 'text-[10px] text-emerald-400 font-bold uppercase tracking-wider';
            toggleAiBtn.textContent = 'Pause AI';
            toggleAiBtn.className = 'px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-lg transition-all shadow-md active:scale-95';
        } else {
            aiStatusDot.className = 'animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75';
            aiStatusDotFixed.className = 'relative inline-flex rounded-full h-3 w-3 bg-rose-500';
            aiStatusText.textContent = 'Paused / Off';
            aiStatusText.className = 'text-[10px] text-rose-400 font-bold uppercase tracking-wider';
            toggleAiBtn.textContent = 'Resume AI';
            toggleAiBtn.className = 'px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95';
        }
    } catch (error) {
        console.error('Failed to load AI status:', error);
    }
}

async function toggleAIResponder() {
    const btn = document.getElementById('toggleAiBtn');
    btn.disabled = true;
    try {
        const response = await fetch('/api/whatsapp/ai-toggle', { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            await loadAIStatus();
        }
    } catch (error) {
        console.error('Failed to toggle AI Auto-responder:', error);
    } finally {
        btn.disabled = false;
    }
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
