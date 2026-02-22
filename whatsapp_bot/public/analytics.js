document.addEventListener('DOMContentLoaded', () => {
    loadAnalytics();

    document.getElementById('refreshBtn').addEventListener('click', loadAnalytics);
    document.getElementById('getAdviceBtn').addEventListener('click', generateAIAdvice);
});

async function loadAnalytics() {
    // Show loading
    document.getElementById('tableLoading').classList.remove('hidden');
    document.getElementById('tableEmpty').classList.add('hidden');
    document.getElementById('campaignTableBody').innerHTML = '';

    try {
        const response = await fetch('/api/analytics');
        if (!response.ok) throw new Error('Failed to fetch analytics');

        const campaigns = await response.json();

        // Populate stats
        updateDashboardStats(campaigns);

        // Populate table
        renderCampaignTable(campaigns);

        // Update AI Advisor State
        if (campaigns.length > 0) {
            document.getElementById('adviceEmpty').classList.add('hidden');
            document.getElementById('getAdviceBtn').classList.remove('hidden');

            // Hide previous advice if any, prompt user to click again if they want fresh
            document.getElementById('adviceContainer').classList.add('hidden');
        } else {
            document.getElementById('adviceEmpty').classList.remove('hidden');
            document.getElementById('getAdviceBtn').classList.add('hidden');
        }

    } catch (error) {
        console.error('Error loading analytics:', error);
        alert('Failed to load campaign data. Please check console for Details.');
    } finally {
        document.getElementById('tableLoading').classList.add('hidden');
    }
}

function updateDashboardStats(campaigns) {
    let totalSent = 0;
    let totalFailed = 0;

    campaigns.forEach(c => {
        totalSent += c.sent || 0;
        totalFailed += c.failed || 0;
    });

    const totalContacts = totalSent + totalFailed;
    const successRate = totalContacts > 0 ? Math.round((totalSent / totalContacts) * 100) : 0;

    // Animate numbers
    animateValue("stat-total-campaigns", 0, campaigns.length, 1000);
    animateValue("stat-total-sent", 0, totalSent, 1000);
    animateValue("stat-total-failed", 0, totalFailed, 1000);

    const rateEl = document.getElementById("stat-success-rate");
    rateEl.textContent = `${successRate}%`;

    // Color code success rate
    if (successRate >= 90) rateEl.className = "text-3xl font-bold text-emerald-400 mt-2 relative";
    else if (successRate >= 70) rateEl.className = "text-3xl font-bold text-yellow-400 mt-2 relative";
    else rateEl.className = "text-3xl font-bold text-rose-400 mt-2 relative";
}

function renderCampaignTable(campaigns) {
    const tbody = document.getElementById('campaignTableBody');

    if (campaigns.length === 0) {
        document.getElementById('tableEmpty').classList.remove('hidden');
        return;
    }

    campaigns.forEach(campaign => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-dark-card/50 transition-colors cursor-default group';

        const dateStr = new Date(campaign.createdAt).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Badge styling for template type
        const typeBadge = campaign.templateId?.type === 'poll'
            ? '<span class="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-md text-xs font-semibold uppercase tracking-wider">Poll</span>'
            : '<span class="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-xs font-semibold uppercase tracking-wider">Text/Image</span>';

        // Calculate success styling for the row
        const totalTargeted = campaign.total || (campaign.sent + campaign.failed);
        const failColor = campaign.failed > 0 ? 'text-rose-400 font-bold' : 'text-slate-400';

        tr.innerHTML = `
            <td class="p-4 pl-6 text-slate-400 whitespace-nowrap">${dateStr}</td>
            <td class="p-4 font-medium text-slate-200">${campaign.name}</td>
            <td class="p-4">${typeBadge}</td>
            <td class="p-4 text-center text-emerald-400 font-semibold">${campaign.sent}</td>
            <td class="p-4 text-center ${failColor}">${campaign.failed}</td>
            <td class="p-4 pr-6 text-right font-medium text-slate-300">${totalTargeted}</td>
        `;

        tbody.appendChild(tr);
    });
}

async function generateAIAdvice() {
    const btn = document.getElementById('getAdviceBtn');
    const loading = document.getElementById('adviceLoading');
    const container = document.getElementById('adviceContainer');
    const content = document.getElementById('adviceContent');

    // UI state loading
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.innerHTML = 'Analyzing...';

    container.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
        const response = await fetch('/api/analytics/advice');
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        // Simple markdown parsing to format bullet points or bold text from AI
        let formattedAdvice = data.advice
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="text-purple-200">$1</em>');

        content.innerHTML = formattedAdvice;

        // Switch UI
        loading.classList.add('hidden');
        container.classList.remove('hidden');

    } catch (error) {
        console.error('Failed to get AI Advice:', error);
        alert('Failed to reach AI service. Check connection or try again.');
        loading.classList.add('hidden');
    } finally {
        // Restore btn
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
        </svg> Generate Fresh Advice`;
    }
}

// Utility for animating number counters
function animateValue(id, start, end, duration) {
    if (start === end) {
        document.getElementById(id).innerHTML = end;
        return;
    }
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        document.getElementById(id).innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}
