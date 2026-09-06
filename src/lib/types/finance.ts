export type BankName = 'Tenge Bank' | 'Asaka Bank' | 'Halyk Bank' | 'Kaspi' | 'Sber' | 'Tinkoff' | 'Other';

export interface MyCompany {
    id: string;
    brandName: string; // Напр: FLOW
    legalName: string; // Напр: OOO "FLOW FOOD"
    inn: string;
}

export interface Contractor {
    id: string;
    name: string;
    brandName?: string;
    legalName?: string;
    alias?: string; // Понятное имя для сотрудника
    aliases?: string[];
    inn?: string;
    phone?: string;
    email?: string;
    address?: string;
    
    // Банковские детали (для переводов)
    bankAccount?: string;
    bankName?: string;
    bankCode?: string;
    defaultPaymentCode?: string;

    // Логистика и Баланс (Перенесено из Suppliers)
    balance: number; // В копейках (типа cents)
    priceList?: Array<{
        id: string;
        name: string;
        sku?: string;
        unit: string;
        price: number;
        linkedPosterId?: string;
    }>;
    
    posterId?: string;
    isActive: boolean;
    allowCash: boolean;
    createdAt?: any;
    updatedAt?: any;
}

export interface BankAccount {
    id: string;
    type: 'BANK' | 'CASH'; // Тип счета: Банк или Наличные
    companyId: string; // Ссылка на MyCompany
    bankName: string; // Название банка или "Наличные (Сейф)"
    accountNumber: string; // 20-значный номер или "CASH-MAIN"
    currency: string; // UZS, USD, etc.
    balance?: number; // Текущий расчетный остаток
    isDefault?: boolean;
}

export interface FinanceTransaction {
    id: string;
    type: 'income' | 'expense' | 'unknown';
    status: 'pending' | 'completed' | 'rejected' | 'archived' | 'draft';
    source: 'telegram_bot' | 'manual_entry' | 'external_api' | 'web_test' | 'web_form';
    
    documentId?: string | null; // Уникальный номер платежки/перевода
    amount: number | null;
    currency: string;
    
    // Новая логика связи со своими счетами
    myCompanyId?: string;
    myAccountId?: string; 
    contractorId?: string | null; // Ссылка на контрагента в базе
    
    // Контрагент
    counterparty: string;
    counterpartyInn?: string | null;
    counterpartyAccount?: string | null;
    
    // Банковские коды
    paymentCode?: string | null; // Код назначения (напр: 00668)
    paymentPurpose?: string | null; // Полный текст назначения
    
    date: string | null;
    comment: string | null;
    receiptImageUrl?: string | null;
    receiptStoragePath?: string | null;
    
    metadata?: {
        telegramMessageId?: number;
        telegramChatId?: string | number;
        senderId?: number;
        senderUsername?: string;
        rawAiData?: any;
        isInvoice?: boolean;
        docType?: string;
        qualityControl?: {
            isTruncated: boolean;
            isBlurred: boolean;
            warningMessage?: string;
            confidenceLevel?: number;
            validationError?: string;
        };
        items?: Array<{
            name: string;
            qty: number;
            price: number;
            sum: number;
        }>;
        aiError?: string;
        aiComment?: string;
        approvedBy?: string;
        rejectedBy?: string;
        history?: Array<{
            date: any;
            userId: string;
            userName: string;
            action: 'create' | 'update' | 'delete' | 'status_change';
            changes?: Record<string, { old: any; new: any }>;
            comment?: string;
        }>;
    };
    
    createdAt: any; 
    updatedAt: any;
}
