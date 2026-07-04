export type WhatsAppConnection = {
  id: string;
  business_id: string;
  phone_number_id: string;
  business_account_id: string;
  verify_token: string;
  webhook_secret: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type WhatsAppConnectionStatus =
  | "connected"
  | "disconnected"
  | "error";