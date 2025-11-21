// Messaging service exports
export { emailService } from '../email/emailService';
export { smsService } from '../sms/smsService';
export { whatsAppService } from '../whatsapp/whatsappService';
<<<<<<< HEAD
export { whatsAppService as whatsappService } from '../whatsapp/whatsappService';
=======
>>>>>>> 08d9e1855dc7fd2c99e5d62def516239ff37a9a7

export type { SMSTemplate, SMSOptions } from '../sms/smsService';
export type { EmailTemplate, EmailOptions } from '../email/emailService';
export type { WhatsAppMessage, WhatsAppTemplate } from '../whatsapp/whatsappService';

