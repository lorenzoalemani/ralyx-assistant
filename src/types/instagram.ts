export type InstagramConnection = {
  id:                          string;
  business_id:                 string;
  page_id:                     string;
  instagram_id:                string;
  verify_token:                string;
  webhook_secret:              string;
  page_access_token_encrypted: string;
  active:                      boolean;
  created_at:                  string;
  updated_at:                  string;
};

export type InstagramConnectionStatus =
  | "connected"
  | "disconnected"
  | "error";