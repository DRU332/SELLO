export type DoubleRule = { days: number[]; from: string; to: string };

export type Program = {
  stamps_required: number;
  signup_gift: number;
  reward_final: string;
  reward_mid: string | null;
  reward_mid_at: number | null;
  valid_from: string | null;
  valid_until: string | null;
  restrictions: string;
  cooldown_minutes: number;
  double_rules: DoubleRule[];
};

export type StampIconName = "cafe" | "estrella" | "corazon" | "cubiertos" | "pan" | "taco" | "hoja" | "regalo";

export type PublicBusiness = {
  id: string;
  slug: string;
  name: string;
  status: "trial" | "active" | "suspended";
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  stamp_icon: StampIconName;
  timezone: string;
  program: Program;
};

export type CardState = {
  card_id: string;
  cycle: number;
  stamps: number;
  gift_stamps: number;
  mid_redeemed: boolean;
  total_visits: number;
  rewards_redeemed: number;
  last_visit_at: string | null;
};

export type CustomerCard = {
  customer: { name: string; qr_code: string; marketing_opt_in: boolean; phone_masked: string; created_at: string };
  business: PublicBusiness;
  state: CardState;
  history: { at: string; kind: string; amount: number; is_double: boolean }[];
};

export type StaffCustomerView = {
  customer_id: string;
  name: string;
  phone_masked: string | null;
  state: CardState;
  stamps_required: number;
  reward_final: string;
  reward_mid: string | null;
  reward_mid_at: number | null;
  can_stamp: boolean;
  blocked_reason: string | null;
  wait_minutes: number;
  multiplier: number;
  can_redeem_final: boolean;
  can_redeem_mid: boolean;
};
