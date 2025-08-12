// Messaging service exports
export { emailService } from '../email/emailService';
export { smsService } from '../sms/smsService';
export { whatsAppService } from '../whatsapp/whatsappService';

export type { SMSTemplate, SMSOptions } from '../sms/smsService';
export type { EmailTemplate, EmailOptions } from '../email/emailService';
export type { WhatsAppMessage, WhatsAppTemplate } from '../whatsapp/whatsappService';

