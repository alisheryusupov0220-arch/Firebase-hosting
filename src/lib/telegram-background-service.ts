import axios from 'axios';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TOKEN}`;
const INTERNAL_WEBHOOK_URL = `http://localhost:${process.env.PORT || 9002}/api/telegram-webhook`;

/**
 * ГЛОБАЛЬНЫЙ ФЛАГ (через global, чтобы выжить при Hot Reload)
 */
const globalForTg = global as unknown as { isPolling: boolean; lastUpdateId: number };

export function startTelegramPolling() {
    if (process.env.NODE_ENV !== 'development') return; 
    if (globalForTg.isPolling) return;
    if (process.env.TELEGRAM_DISABLE_POLLING === 'true') {
        console.log('ℹ️ Telegram Polling отключен (используется Webhook)');
        return;
    }
    if (!TOKEN) {
        console.warn('⚠️ Telegram Polling: TOKEN не найден, фоновая служба не запущена.');
        return;
    }

    globalForTg.isPolling = true;
    globalForTg.lastUpdateId = globalForTg.lastUpdateId || 0;
    
    console.log('🤖 [Background AI] Служба Telegram запущена (в фоновом режиме Next.js)');
    
    // Сбрасываем вебхук (чтобы работал Long Polling)
    axios.get(`${API_URL}/setWebhook?url=`).catch(() => {});

    const poll = async () => {
        try {
            // console.log(`📡 Polling TG (offset: ${globalForTg.lastUpdateId + 1})...`);
            const response = await axios.get(`${API_URL}/getUpdates`, {
                params: { offset: globalForTg.lastUpdateId + 1, timeout: 20 },
                timeout: 25000
            });
            
            const updates = response.data.result;
            if (updates && updates.length > 0) {
                console.log(`📩 Background TG: Получено ${updates.length} событий`);
                for (const update of updates) {
                    globalForTg.lastUpdateId = update.update_id;
                    const sender = update.message?.from?.username || update.callback_query?.from?.username || 'user';
                    console.log(`   - Обработка события от @${sender}`);
                    
                    try {
                        // Отправляем на наш собственный API роут
                        const postRes = await axios.post(INTERNAL_WEBHOOK_URL, update, {
                            timeout: 5000
                        });
                        console.log(`   ✅ Передано на ${INTERNAL_WEBHOOK_URL}. Статус: ${postRes.status}`);
                    } catch (err: any) {
                        console.error(`   ❌ Ошибка передачи на ${INTERNAL_WEBHOOK_URL}:`, err.message);
                        if (err.response) console.error('     Детали:', err.response.data);
                    }
                }
            }
        } catch (e: any) {
            if (e.code !== 'ECONNABORTED') {
                console.error('⚠️ Background TG Connection Error:', e.message);
                if (e.response && e.response.status === 409) {
                    console.warn('   (Код 409: Другой опрос активен. Попробуем снова через 5с)');
                }
                await new Promise(r => setTimeout(r, 5000));
            }
        }
        
        // Продолжаем цикл
        if (globalForTg.isPolling) poll();
    };

    poll();
}
