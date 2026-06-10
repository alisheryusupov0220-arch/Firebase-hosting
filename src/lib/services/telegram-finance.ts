import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function getFileDownloadUrl(fileId: string): Promise<string | null> {
    try {
        const response = await axios.get(`${API_URL}/getFile`, {
            params: { file_id: fileId },
        });

        if (!response.data || !response.data.result) return null;

        const filePath = response.data.result.file_path;
        return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;
    } catch (e) {
        console.error('Ошибка получения файла из Telegram:', e);
        return null;
    }
}

export async function downloadFileAsBase64(url: string): Promise<string | null> {
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        return buffer.toString('base64');
    } catch (e) {
        console.error('Ошибка скачивания файла:', e);
        return null;
    }
}

export async function sendMessage(chatId: string | number, text: string, options: { replyMarkup?: any, topicId?: number } = {}) {
    try {
        const payload: any = {
            chat_id: chatId,
            text,
            parse_mode: 'HTML',
        };

        if (options.topicId) {
            payload.message_thread_id = options.topicId;
        }

        if (options.replyMarkup) {
            payload.reply_markup = JSON.stringify(options.replyMarkup);
        }

        await axios.post(`${API_URL}/sendMessage`, payload);
    } catch (e: any) {
        console.error('Ошибка отправки сообщения:', e.response?.data || e.message);
    }
}

export async function answerCallbackQuery(callbackQueryId: string, text: string, showAlert = false) {
    try {
        await axios.post(`${API_URL}/answerCallbackQuery`, {
            callback_query_id: callbackQueryId,
            text,
            show_alert: showAlert
        });
    } catch (e: any) {
        console.error('Ошибка ответа на callback_query:', e.response?.data || e.message);
    }
}

export async function editMessageText(chatId: string | number, messageId: number, text: string, options: { replyMarkup?: any } = {}) {
    try {
        const payload: any = {
            chat_id: chatId,
            message_id: messageId,
            text,
            parse_mode: 'HTML',
        };

        if (options.replyMarkup) {
            payload.reply_markup = JSON.stringify(options.replyMarkup);
        }

        await axios.post(`${API_URL}/editMessageText`, payload);
    } catch (e: any) {
        console.error('Ошибка редактирования сообщения:', e.response?.data || e.message);
    }
}

export async function setWebhook(url: string) {
    try {
        const response = await axios.post(`${API_URL}/setWebhook`, { url });
        return response.data;
    } catch (e) {
        console.error('Ошибка установки Webhook:', e);
        return { ok: false, error: e };
    }
}

export async function getMe() {
    try {
        const response = await axios.get(`${API_URL}/getMe`);
        return response.data;
    } catch (e) {
        return { ok: false, error: e };
    }
}
