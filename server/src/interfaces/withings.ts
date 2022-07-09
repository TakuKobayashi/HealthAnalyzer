export interface RequestTokenSignatureBasic {
  action: string;
  client_id: string;
  nonce: string;
  signature: string;
}

export interface WithingsAccount {
  withings_user_id: string;
  access_token: string;
  refresh_token: string;
  expired_at: number;
  line_user_id: string;
}
