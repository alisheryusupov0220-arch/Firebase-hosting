export interface RecognizedDocument {
    doc_type: string;
    document_id?: string;
    date: string;
    counterparty: string;
    counterpartyInn?: string;
    myAccountNumber?: string;
    senderAccount?: string;
    recipientAccount?: string;
    type: 'income' | 'expense' | 'unknown';
    amount?: number;
    amounts?: { total: number; vat: number; currency: string };
    items?: Array<{ name: string; qty: number; price: number; sum: number }>;
    currency?: string;
    comment?: string;
    
    // Поля для реквизитов (doc_type === 'requisites')
    mfo?: string;
    bankAccount?: string;
    bankName?: string;
    address?: string;
    phone?: string;
    
    error?: string;

    // Совместимость со старыми полями
    bank_or_source?: string;
    inn?: string;
    account_number?: string;
    purpose?: string;
}
