# PocketBase Collections

PocketBase bu MVP'de sistemin operasyonel kaynak verisidir. Kart numarasi, CVV ve banka ham cevaplarindaki hassas alanlar saklanmaz.

## donors

- `first_name` text, required
- `last_name` text, required
- `full_name` text
- `email` email, required
- `phone_e164` text, required

## transactions

- `donor` relation -> donors
- `client_ref_code` text
- `frequency` select: `one_time`, `monthly`
- `amount` number, required
- `currency` text, default `TRY`
- `donation_note` text
- `recurring_count` number
- `recurring_period_days` number
- `total_committed_amount` number
- `status` select: `pending`, `awaiting_3d`, `awaiting_subscription_confirmation`, `success`, `failed`
- `nkolay_payment_id` text
- `installment` number
- `foreign_card` bool
- `payment_mode` select: `3d`, `2d`
- `error_code` text
- `error_message` text

## subscriptions

- `donor` relation -> donors
- `transaction` relation -> transactions
- `nkolay_instruction_id` text, required
- `amount` number, required
- `installment_count` number
- `installment_period_days` number
- `total_committed_amount` number
- `status` select: `pending`, `active`, `failed`, `cancelled`
- `next_payment_date` text
- `failure_reason` text

## payment_events

- `transaction` relation -> transactions, optional
- `type` text, required
- `provider` select: `nkolay`, `system`
- `payload` json
- `created_at` date

## iban_accounts

UI su anda `.env` bagimsiz varsayilan liste ile acilir. Canli ortamda PocketBase'den okumaya gecmek icin koleksiyon:

- `bank_name` text
- `account_name` text
- `iban` text
- `currency` text
- `active` bool
- `sort_order` number
