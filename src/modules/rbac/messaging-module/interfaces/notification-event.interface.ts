import { NotificationChannel } from '../enums/notification-channel.enum';

export interface NotificationEvent {
  userId: string;
  recipientId?: string; // Alias pour userId
  type: string;
  assignedRoleId?: string;
  channel?: NotificationChannel | NotificationChannel[];
  templateCode?: string;
  template?: string; // Alias pour templateCode
  title?: string;
  content?: string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH';
  email?: string;
  phone?: string;
  variables?: Record<string, any>;
  data?: Record<string, any>; // Alias pour variables
}
