export interface LowItem {
  name: string;
  value: string;
}

export interface SheetReport {
  sheetName: string;
  lastRowIndex: number; // 1-based index in sheet
  headers: string[];
  values: string[];
  lowItems: LowItem[];
  hasLowStock: boolean;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface DiscordConfig {
  webhookUrl: string;
  enabled: boolean;
}

export interface WebhookConfig {
  url: string;
  enabled: boolean;
}

export interface PushoverConfig {
  userKey: string;
  apiToken: string;
  enabled: boolean;
}

export interface NotificationConfigs {
  telegram: TelegramConfig;
  discord: DiscordConfig;
  webhook: WebhookConfig;
  pushover: PushoverConfig;
}

export interface AlertFilter {
  type: 'all' | 'alert_only';
  searchText: string;
}
