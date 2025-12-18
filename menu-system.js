// --- HTML ŞABLONLARI ---
// Bu HTML yapılarını JS ile oluşturup sayfaya enjekte edeceğiz.

const LEADERBOARD_HTML = `
<div id="modal-leaderboard" class="content-modal hidden">
    <div class="modal-header">
        <span>🏆 Lider Tablosu</span>
        <button class="close-btn" onclick="window.closeMenus()">✕</button>
    </div>
    <div class="modal-body" id="lb-content">
        <div style="text-align:center; padding:20px;">Yükleniyor...</div>
    </div>
</div>`;

const VAULT_HTML = `
<div id="modal-vault" class="content-modal hidden">
    <div class="modal-header">
        <span>🎒 Envanter (Vault)</span>
        <button class="close-btn" onclick="window.closeMenus()">✕</button>
    </div>
    <div class="modal-body">
        <div class="vault-grid" id="vault-content">
            </div>
    </div>
</div>`;

const FRIENDS_HTML = `
<div id="modal-friends" class="content-modal hidden">
    <div class="modal-header">
        <span>👥 Arkadaşlar</span>
        <button class="close-btn" onclick="window.closeMenus()">✕</button>
    </div>
    <div class="modal-body">
        <div class="invite-box">
            <i class="fa-solid fa-gift" style="font-size:40px; color:#4a0e8f; margin-bottom:10px;"></i>
            <h3>Arkadaşını Davet Et!</h3>
            <p>Her davet için +500 🥧 kazan.</p>
            <div class="invite-link" id="ref-link">https://t.me/BluppieBot...</div>
            <button class="btn-play small" onclick="window.shareInvite()">Davet Et</button>
        </div>
        <h4 style="margin-top:20px;">Davet Ettiklerin (0)</h4>
        <p style="color:#888; text-align:center;">Henüz kimseyi davet etmedin.</p>
    </div>
</div>`;

// --- SİSTEMİ BAŞLAT ---
export function initMenuSystem() {
    // 1. HTML'i Sayfaya Ekle (ui-layer içine)
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    // Modalları ekle (String birleştirme ile)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = LEADERBOARD_HTML + VAULT_HTML + FRIENDS_HTML;
    while (tempDiv.firstChild) {
        uiLayer.appendChild(tempDiv.firstChild);
    }

    // 2. Alt Menü Butonlarına Tıklama Olaylarını Bağla
    // (index.html'deki butonların sırasına göre)
    const navItems = document.querySelectorAll('.nav-item');
    if (navItems.length >= 3) {
        navItems[0].addEventListener('click', () => openModal('leaderboard')); // Leaderboard
        navItems[1].addEventListener('click', () => openModal('vault'));       // Vault
        navItems[2].addEventListener('click', () => openModal('friends'));     // Friends
    }
}

// --- MODAL YÖNETİMİ ---
window.closeMenus = function() {
    document.querySelectorAll('.content-modal').forEach(el => el.classList.add('hidden'));
    // Buton aktifliklerini temizle
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
};

function openModal(type) {
    window.closeMenus(); // Önce hepsini kapat

    // İlgili modalı aç
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.classList.remove('hidden');

    // İçeriği güncelle (Dinamik veri)
    if (type === 'leaderboard') loadLeaderboardData();
    if (type === 'vault') loadVaultData();
    if (type === 'friends') loadFriendsData();
}

// --- İÇERİK DOLDURMA FONKSİYONLARI ---

// 1. LEADERBOARD (Sahte Veri Simülasyonu)
function loadLeaderboardData() {
    const container = document.getElementById('lb-content');
    let html = '';
    
    // Örnek Veriler
    const users = [
        { name: "CryptoKing", score: 9540 },
        { name: "BluppieMaster", score: 8200 },
        { name: "TonHolder", score: 7850 },
        { name: "SpeedRunner", score: 6900 },
        { name: "Sen (You)", score: 0, isMe: true } // Buraya gerçek skorunu game.js'den çekebiliriz
    ];

    users.forEach((u, index) => {
        html += `
        <div class="leaderboard-row ${u.isMe ? 'my-rank' : ''}">
            <span class="rank">#${index + 1}</span>
            <div class="player-info">
                <div class="p-avatar"></div> <span>${u.name}</span>
            </div>
            <span class="p-score">${u.score}</span>
        </div>`;
    });

    container.innerHTML = html;
}

// 2. VAULT (Skin Listesi)
function loadVaultData() {
    const container = document.getElementById('vault-content');
    // Burada ileride localStorage'dan alınan skinleri kontrol edebiliriz
    const items = [
        { id: 'red', name: 'Klasik Kırmızı', icon: '🟥', owned: true, selected: true },
        { id: 'ghost', name: 'Hayalet', icon: '👻', owned: false, price: 500 },
        { id: 'gold', name: 'Altın', icon: '👑', owned: false, price: 1000 },
        { id: 'toxic', name: 'Zehirli', icon: '🟢', owned: false, price: 750 }
    ];

    let html = '';
    items.forEach(item => {
        const statusClass = item.selected ? 'selected' : (item.owned ? 'owned' : '');
        const btnText = item.selected ? 'Seçili' : (item.owned ? 'Kuşan' : `${item.price} 🥧`);
        
        html += `
        <div class="vault-item ${statusClass}">
            <span class="vault-img">${item.icon}</span>
            <div style="font-weight:bold; font-size:12px;">${item.name}</div>
            <button class="btn-secondary" style="margin-top:5px; padding:5px; width:100%; font-size:10px;">
                ${btnText}
            </button>
        </div>`;
    });
    container.innerHTML = html;
}

// 3. FRIENDS (Davet Linki)
function loadFriendsData() {
    const tg = window.Telegram.WebApp;
    const userId = tg.initDataUnsafe?.user?.id || '12345';
    const link = `https://t.me/BluppieBot?start=${userId}`;
    
    document.getElementById('ref-link').innerText = link;
    
    window.shareInvite = function() {
        // Telegram paylaşım ekranını açar
        const shareText = "Bluppie Runner'da rekorumu geçebilir misin? Gel ve oyna!";
        const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
        tg.openTelegramLink(url);
    };
}
