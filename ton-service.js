// TON Connect UI kütüphanesini başlatıyoruz.
// 
// Neden Bu Link? (MANIFEST_URL)
// Yerel geliştirme (localhost) sırasında tarayıcı güvenlik kısıtlamaları nedeniyle 
// kendi yerel manifest dosyamızı okumakta zorlanabiliriz. Bu yüzden, 
// TON Connect'in resmi olarak izin verdiği ve güvenilir demo manifestini kullanıyoruz. 
// Projeyi yayına aldığınızda burayı kendi uygulamanızın HTTPS adresine değiştirmelisiniz.
const MANIFEST_URL = 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json';

// Cüzdan Bağlantı Arayüzünü Başlatma
export const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
    manifestUrl: MANIFEST_URL,
    buttonRootId: 'ton-connect-btn' // HTML'deki TON Connect butonunun ID'si
});

// Ayarlar
// ÖDEME ADRESİ: Tokenların veya TON'un gönderileceği, oyunun kasası olan cüzdan adresi.
// Gerçek projede bu adres, FunC/Tact kontrat adresi de olabilir.
const PAYMENT_DESTINATION = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N"; 
// NFT Kontrolü: Bu, kontrol edilecek NFT koleksiyonunun adresi olmalı (Şu an kullanılmıyor, simülasyon yapılıyor).
// const NFT_COLLECTION_ADDRESS = "EQAG2qh..."; 

// --- 1. Cüzdan Adresini Getirme ---
// Bağlı cüzdanın TON adresini döndürür. Bağlı değilse null döner.
export async function getWalletAddress() {
    const wallet = tonConnectUI.wallet;
    return wallet ? wallet.account.address : null;
}

// --- 2. NFT Sahipliği Kontrolü (Simülasyon) ---
// Oyuncunun özel bir NFT'ye sahip olup olmadığını kontrol eder.
export async function checkNftOwnership(userAddress) {
    if (!userAddress) return false;
    
    // NOT: Gerçek bir uygulamada burada TON API'leri (tonapi.io vb.) kullanılır
    // ve kullanıcının cüzdanının NFT_COLLECTION_ADDRESS'ten NFT'si olup olmadığı sorgulanır.
    
    // Şimdilik test için %50 ihtimalle NFT sahibiymiş gibi davranıyoruz.
    return Math.random() < 0.5; 
}

// --- 3. Oyun Hakkı Satın Alma (TON Transferi) ---
// Kullanıcının cüzdanından belirtilen miktarda TON'u oyunun kasasına gönderir.
export async function purchasePlayReset() {
    const userAddress = await getWalletAddress();
    if (!userAddress) {
        alert("Cüzdan bağlı değil. İşlem yapmak için lütfen cüzdanınızı bağlayın.");
        return false;
    }

    // İşlem (Transaction) Objesi:
    const transaction = {
        // İşlemin geçerli olacağı maksimum süre (60 saniye)
        validUntil: Math.floor(Date.now() / 1000) + 60,
        messages: [
            {
                // Paranın gideceği adres
                address: PAYMENT_DESTINATION,
                // Miktar: 0.05 TON (NanoTON cinsinden 50.000.000)
                amount: "50000000", 
                // Opsiyonel olarak, işlem açıklaması eklenebilir.
                // payload: "te6cckEBAQEAAgAAAABQA..." 
            }
        ]
    };

    try {
        // Cüzdana işlemi imzalaması için istek gönderir.
        await tonConnectUI.sendTransaction(transaction);
        return true;
    } catch (e) {
        console.error("TON İşlemi İptal Edildi veya Hata Oluştu:", e);
        // Kullanıcı işlemi reddederse veya bir hata olursa yakalanır.
        return false;
    }
}