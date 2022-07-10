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
export interface WithingsUserLatestMeasure {
  withing_user_id: string;
  created_at: number;
  date: number;
  updated_at: number;
  weight_kg: number;
  fat_mass_weight_kg: number;
  muscle_mass_kg: number;
  hydration_kg: number;
  bone_mass_kg: number;
  fat_ratio_percent: number;
  fat_free_mass_kg: number;
}
