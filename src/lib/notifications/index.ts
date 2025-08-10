// Notifications service exports
export const createNotification = async (data: {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  userId?: string;
}) => {
  // Simple notification creation
  console.log('Notification:', data);
  return { id: Date.now().toString(), ...data };
};

export type NotificationData = {
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  userId?: string;
};

