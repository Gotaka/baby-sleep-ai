import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// Firebase設定
const app = initializeApp({
    apiKey: "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
    authDomain: "ai-sleep-consultant.firebaseapp.com",
    projectId: "ai-sleep-consultant",
    storageBucket: "ai-sleep-consultant.firebaseapp.com",
    messagingSenderId: "48632759539",
    appId: "1:48632759539:web:1e087f751048a5fba16386",
    measurementId: "G-VXCMH47EV2"
});

const auth = getAuth(app);
const db = getFirestore(app);

// DOM要素の読み込みを待つ
document.addEventListener('DOMContentLoaded', () => {
    // DOM要素
    const elements = {
        babyList: document.getElementById('babyList'),
        addNewBaby: document.getElementById('addNewBaby')
    };

    // DOM要素の存在確認
    if (!elements.babyList) {
        console.error('Baby list element not found');
        return;
    }

    // 認証状態の監視
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                await loadBabies(user.uid);
            } catch (error) {
                console.error('Error loading babies:', error);
                showError('赤ちゃんの情報の読み込みに失敗しました');
            }
        } else {
            window.location.href = 'index.html';
        }
    });

    // 新規赤ちゃん登録ボタンのイベントリスナー
    if (elements.addNewBaby) {
        elements.addNewBaby.addEventListener('click', () => {
            window.location.href = 'baby-register.html';
        });
    }

    // 赤ちゃん一覧を読み込む
    async function loadBabies(userId) {
        try {
            const q = query(collection(db, "babies"), where("userId", "==", userId));
            const querySnapshot = await getDocs(q);
            
            const babyListElement = document.getElementById('babyList');
            if (babyListElement) {
                babyListElement.innerHTML = '';
                
                querySnapshot.forEach((doc) => {
                    const babyData = doc.data();
                    const card = createBabyCard(doc.id, babyData);
                    babyListElement.appendChild(card);
                });
            }
        } catch (error) {
            console.error("Failed to load babies:", error);
            showError("赤ちゃんの情報の読み込みに失敗しました");
        }
    }

    // 会話一覧を読み込む
    async function loadBabyConversations(babyId, user) {
        try {
            const q = query(
                collection(db, "conversations"),
                where("babyId", "==", babyId),
                where("userId", "==", user.uid)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.size;
        } catch (error) {
            console.error("Failed to load conversations:", error);
            return 0;
        }
    }

    // 赤ちゃんカードを作成
    function createBabyCard(babyId, babyData) {
        const card = document.createElement('div');
        card.className = 'baby-card';
        
        const nameElement = document.createElement('h3');
        nameElement.textContent = babyData.name;
        
        const ageElement = document.createElement('p');
        const birthDate = new Date(babyData.birthDate);
        const age = calculateAge(birthDate);
        ageElement.textContent = `${age.years}歳${age.months}ヶ月`;
        
        card.appendChild(nameElement);
        card.appendChild(ageElement);
        
        card.addEventListener('click', () => {
            sessionStorage.setItem('selectedBabyId', babyId);
            sessionStorage.setItem('selectedBabyName', babyData.name);
            sessionStorage.setItem('selectedBabyAge', `${age.years}歳${age.months}ヶ月`);
            sessionStorage.setItem('selectedBabyBirthday', babyData.birthDate);
            window.location.href = 'conversation-select.html';
        });
        
        return card;
    }

    // 年齢計算関数を追加
    function calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        
        // 日にちを考慮した調整
        if (today.getDate() < birth.getDate()) {
            months--;
        }
        
        // 月がマイナスの場合の調整
        if (months < 0) {
            years--;
            months += 12;
        }
        
        return { years, months };
    }

    // エラー表示
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
    }
}); 