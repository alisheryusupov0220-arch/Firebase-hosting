import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Загружаем переменные окружения из .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LOCAL_WEBHOOK_URL = 'http://localhost:9002/api/telegram-webhook';

if (!TOKEN) {
    console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не найден в .env.local');
    process.exit(1);
}

console.log('🚀 БОТ-ПЕРЕХОДНИК ЗАПУЩЕН (Long Polling Mode)');
console.log('📡 Направление: Telegram API -> ' + LOCAL_WEBHOOK_URL);
console.log('--------------------------------------------------');

let lastUpdateId = 0;

async function poll() {
    try {
        const response = await axios.get(`https://api.telegram.org/bot${TOKEN}/getUpdates`, {
            params: { offset: lastUpdateId + 1, timeout: 30 }
        });

        const updates = response.data.result;
        for (const update of updates) {
            lastUpdateId = update.update_id;
            console.log(`📩 Новое событие: ${update.message ? 'Сообщение' : update.callback_query ? 'Кнопка' : 'Другое'}`);
            
            try {
                // ПЕРЕСЫЛАЕМ НА ЛОКАЛЬНЫЙ ВЕБХУК
                await axios.post(LOCAL_WEBHOOK_URL, update);
                console.log('✅ Успешно передано в систему');
            } catch (err) {
                console.error('❌ Ошибка передачи в локальный вебхук:', err.message);
                if (err.response) console.error('Детали:', err.response.data);
            }
        }
    } catch (e) {
        console.error('⚠️ Ошибка подключения к Telegram (проверьте интернет):', e.message);
        // Ждем немного перед повтором при ошибке
        await new Promise(r => setTimeout(r, 5000));
    }
    
    // Рекурсивный вызов для бесконечного цикла
    poll();
}

// Сбрасываем вебхук в Telegram, чтобы использовать Long Polling
async function resetWebhook() {
    try {
        await axios.get(`https://api.telegram.org/bot${TOKEN}/setWebhook?url=`);
        console.log('🧹 Старый Webhook сброшен (это нормально)');
    } catch (e) {
        console.warn('⚠️ Не удалось сбросить вебхук, но продолжаем...');
    }
}

resetWebhook().then(() => poll());
