import { OrderRequest, ERPItem, Supplier } from '../types/erp';

/**
 * Generates a WhatsApp-ready message for an order.
 */
export function generateWhatsAppOrderMessage(order: OrderRequest, supplier: Supplier, items: (ERPItem & { count: number })[]) {
  const date = new Date().toLocaleDateString('ru-UZ');
  
  let message = `*Заказ FLOW от ${date}*\n`;
  message += `*Поставщик:* ${supplier.name}\n`;
  message += `*Тип лимита:* ${order.limitType}\n`;
  message += `--------------------------\n`;
  
  items.forEach((item, index) => {
    message += `${index + 1}. ${item.name} — *${item.count}* ${item.baseUnit}\n`;
  });
  
  if (order.reasonForExcess) {
    message += `\n*Комментарий:* ${order.reasonForExcess}\n`;
  }
  
  message += `\n--------------------------\n`;
  message += `Пожалуйста, подтвердите доставку на ${order.scheduleDay || 'ближайшее время'}.`;
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${supplier.phone?.replace('+', '')}?text=${encodedMessage}`;
}

/**
 * Generates a clean, plain text report for Telegram Bot
 */
export function generatePlainTextOrderReport(order: OrderRequest, supplier: Supplier, items: (ERPItem & { count: number })[]) {
  const date = new Date().toLocaleDateString('ru-UZ');
  
  let report = `📦 ЗАКАЗ FLOW #${order.id}\n`;
  report += `📅 Дата: ${date}\n`;
  report += `👤 Поставщик: ${supplier.name}\n`;
  report += `📊 Тип: ${order.limitType}\n`;
  report += `----------------------------\n`;
  
  items.forEach((item, index) => {
    report += `${index + 1}. [${item.posterId || '---'}] ${item.name} | ${item.count} ${item.baseUnit}\n`;
  });
  
  if (order.reasonForExcess) {
    report += `\n⚠️ Комментарий: ${order.reasonForExcess}\n`;
  }
  
  report += `----------------------------\n`;
  report += `Поставка ожидается: ${order.scheduleDay || 'как можно скорее'}.\n`;
  report += `id:${order.id}`; // Useful for bot to parse back
  
  return report;
}
