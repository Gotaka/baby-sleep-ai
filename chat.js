import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    getDocs, 
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

// 定数定義
const DIFY_API_URL = 'https://api.dify.ai/v1';
const API_KEY = 'app-44DggXgrSQI9FcLCDzLeApHq';
const CHAT_HISTORY_LIMIT = 50;

// Firebase初期化
const app = initializeApp({
    apiKey: "AIzaSyAJRoEA5FmZuzVbVTYsjDZdd4hbZSnzr5A",
    authDomain: "ai-sleep-consultant.firebaseapp.com",
    projectId: "ai-sleep-consultant",
    storageBucket: "ai-sleep-consultant.firebasestorage.app",
    messagingSenderId: "48632759539",
    appId: "1:48632759539:web:1e087f751048a5fba16386",
    measurementId: "G-VXCMH47EV2"
});

const auth = getAuth(app);
const db = getFirestore(app);

// DOM要素の取得と状態管理
const elements = {
    chatMessages: document.querySelector('.chat-messages'),
    messageForm: document.querySelector('.message-form'),
    messageInput: document.querySelector('textarea'),
    selectedBabyName: document.querySelector('.selected-baby-name')
};

let currentUser = null;
let currentBabyId = null;
let currentConversationId = null;

// メッセージ関連の関数
function createMessageElement(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    messageDiv.appendChild(contentDiv);
    return messageDiv;
}

async function saveMessage(content, type) {
    if (!currentUser || !currentBabyId) {
        throw new Error('User or baby ID not set');
    }

    const messageData = {
        content,
        type,
        timestamp: serverTimestamp()
    };

    return await addDoc(
        collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`),
        messageData
    );
}

// 月齢計算用の関数を追加
function calculateAge(birthday) {
    const birthDate = new Date(birthday);
    const today = new Date();
    
    let months = (today.getFullYear() - birthDate.getFullYear()) * 12;
    months -= birthDate.getMonth();
    months += today.getMonth();
    
    return months <= 0 ? 0 : months;
}

// 会話の初期化処理を修正
async function initializeConversation() {
    if (!currentUser || !currentBabyId) return null;

    try {
        // Firestoreから既存の会話IDを取得
        const conversationRef = collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/conversations`);
        const conversationDoc = await getDocs(query(conversationRef, orderBy('createdAt', 'desc'), limit(1)));
        
        if (!conversationDoc.empty) {
            const existingId = conversationDoc.docs[0].data().conversationId;
            if (existingId) return existingId;
        }

        // 月齢を計算
        const birthday = sessionStorage.getItem('selectedBabyBirthday');
        const ageInMonths = calculateAge(birthday);

        // 新しい会話を作成（エンドポイントとメソッドを修正）
        const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: "会話を開始します",
                user: currentUser.uid,
                inputs: {
                    birthday: birthday,
                    age_months: ageInMonths,
                    language: "日本語",
                    name: sessionStorage.getItem('selectedBabyName')
                }
            })
        });

        if (!response.ok) {
            throw new Error('会話の作成に失敗しました');
        }

        const data = await response.json();
        
        // 会話IDをFirestoreに保存
        await addDoc(conversationRef, {
            conversationId: data.conversation_id,
            createdAt: serverTimestamp()
        });

        return data.conversation_id;
    } catch (error) {
        console.error('会話の初期化エラー:', error);
        return null;
    }
}

// スクロール制御関数を追加
function scrollToMessage(messageElement, offset = 0) {
    const container = elements.chatMessages;
    const messageTop = messageElement.offsetTop;
    container.scrollTop = messageTop - offset;
}

// メッセージ送信処理のローディング表示部分を修正
async function sendMessage(message) {
    if (!message.trim() || !currentUser || !currentBabyId) {
        console.error('送信条件が満たされていません');
        return;
    }

    try {
        // 会話IDの確認と初期化
        if (!currentConversationId) {
            currentConversationId = await initializeConversation();
            if (!currentConversationId) {
                throw new Error('会話の初期化に失敗しました');
            }
        }

        // ユーザーメッセージを表示
        const userDiv = document.createElement('div');
        userDiv.className = 'message user-message';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        userDiv.appendChild(contentDiv);
        elements.chatMessages.appendChild(userDiv);
        
        // ユーザーメッセージを保存
        await addDoc(collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`), {
            content: message,
            type: 'user',
            timestamp: serverTimestamp()
        });

        // ローディング表示
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message ai-message';
        const loadingContent = document.createElement('div');
        loadingContent.className = 'message-content';
        loadingContent.textContent = '回答を考えています...';
        loadingDiv.appendChild(loadingContent);
        elements.chatMessages.appendChild(loadingDiv);

        // ローディング表示を確実に見せるためのスクロール
        setTimeout(() => {
            elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
            // スクロールが確実に完了するまで再試行
            const checkScroll = setInterval(() => {
                if (elements.chatMessages.scrollTop + elements.chatMessages.clientHeight < elements.chatMessages.scrollHeight) {
                    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
                } else {
                    clearInterval(checkScroll);
                }
            }, 50);
            // 一定時間後にチェックを停止
            setTimeout(() => clearInterval(checkScroll), 500);
        }, 10);

        try {
            // AI応答を取得
            const response = await fetch(`${DIFY_API_URL}/chat-messages`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query: message,
                    response_mode: "blocking",
                    conversation_id: currentConversationId,
                    user: currentUser.uid,
                    inputs: {
                        birthday: sessionStorage.getItem('selectedBabyBirthday'),
                        age_months: calculateAge(sessionStorage.getItem('selectedBabyBirthday')),
                        language: "日本語",
                        name: sessionStorage.getItem('selectedBabyName')
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();

            // ローディング表示の更新を停止
            clearInterval(loadingInterval);
            
            // ローディング表示を削除
            elements.chatMessages.removeChild(loadingDiv);

            if (!data || !data.answer) {
                throw new Error('無効な応答フォーマット');
            }

            // AI応答を表示
            const aiDiv = document.createElement('div');
            aiDiv.className = 'message ai-message';
            const aiContent = document.createElement('div');
            aiContent.className = 'message-content';
            aiContent.textContent = data.answer;
            aiDiv.appendChild(aiContent);
            elements.chatMessages.appendChild(aiDiv);

            // ユーザーの質問が見えるようにスクロール
            setTimeout(() => {
                const containerHeight = elements.chatMessages.clientHeight;
                const offset = Math.max(containerHeight * 0.3, 100); // コンテナの30%または100px
                scrollToMessage(userDiv, offset);
            }, 100);

            // AI応答を保存
            if (data.answer) {
                await addDoc(collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`), {
                    content: data.answer,
                    type: 'ai',
                    timestamp: serverTimestamp()
                });
            }

        } catch (error) {
            // エラー時もローディング表示の更新を停止
            clearInterval(loadingInterval);
            throw error;
        }

    } catch (error) {
        console.error('エラー:', error);
        
        // エラーの種類に応じて処理
        if (error.message.includes('conversation not found')) {
            // 会話が見つからない場合は再初期化
            currentConversationId = null;
            showError('会話を再初期化します。もう一度送信してください。');
        } else {
            // その他のエラー
            showError(`メッセージの送信に失敗しました: ${error.message}`);
        }
    }
}

// ユーティリティ関数
function scrollToBottom() {
    if (elements.chatMessages) {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }
}

function showError(message) {
    if (elements.chatMessages) {
        const errorElement = createMessageElement(message, 'error');
        elements.chatMessages.appendChild(errorElement);
        scrollToBottom();
    }
    console.error(message);
}

// チャット履歴の読み込み
async function loadChatHistory() {
    if (!currentUser || !currentBabyId) return;

    try {
        const chatQuery = query(
            collection(db, `users/${currentUser.uid}/babyInfo/${currentBabyId}/chats`),
            orderBy('timestamp', 'desc'),
            limit(CHAT_HISTORY_LIMIT)
        );
        
        const querySnapshot = await getDocs(chatQuery);
        if (!elements.chatMessages) return;
        
        elements.chatMessages.innerHTML = '';
        const messages = [];
        querySnapshot.forEach(doc => messages.push(doc.data()));
        
        messages.reverse().forEach(msg => {
            const messageElement = createMessageElement(msg.content, msg.type);
            elements.chatMessages.appendChild(messageElement);
        });
        
        scrollToBottom();
    } catch (error) {
        showError('チャット履歴の読み込みに失敗しました');
    }
}

// イベントリスナーの設定
if (elements.messageForm && elements.messageInput) {
    elements.messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = elements.messageInput.value.trim();
        if (!message) return;

        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
        await sendMessage(message);
    });

    elements.messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 150) + 'px';
    });
}

// 認証状態の監視と初期化
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    currentUser = user;
    currentBabyId = sessionStorage.getItem('selectedBabyId');
    const babyName = sessionStorage.getItem('selectedBabyName');

    if (!currentBabyId || !babyName) {
        showError('赤ちゃんが選択されていません');
        setTimeout(() => window.location.href = 'baby-select.html', 2000);
        return;
    }

    if (elements.selectedBabyName) {
        elements.selectedBabyName.textContent = `${babyName} の相談`;
    }

    // 会話を初期化
    currentConversationId = await initializeConversation();
    
    await loadChatHistory();
}); 