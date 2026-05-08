migrate((app) => {
  const exists = (name) => {
    try {
      app.findCollectionByNameOrId(name)
      return true
    } catch {
      return false
    }
  }

  const save = (collection) => {
    if (!exists(collection.name)) {
      app.save(collection)
    }
    return app.findCollectionByNameOrId(collection.name)
  }

  const donors = save(new Collection({
    type: "base",
    name: "donors",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "first_name", type: "text", required: true },
      { name: "last_name", type: "text", required: true },
      { name: "full_name", type: "text" },
      { name: "email", type: "email", required: true },
      { name: "phone_e164", type: "text", required: true }
    ],
    indexes: [
      "CREATE INDEX idx_donors_email ON donors (email)",
      "CREATE INDEX idx_donors_phone ON donors (phone_e164)"
    ]
  }))

  const transactions = save(new Collection({
    type: "base",
    name: "transactions",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "donor", type: "relation", collectionId: donors.id, maxSelect: 1 },
      { name: "client_ref_code", type: "text" },
      { name: "frequency", type: "select", maxSelect: 1, values: ["one_time", "monthly"] },
      { name: "amount", type: "number", required: true },
      { name: "currency", type: "text" },
      { name: "donation_note", type: "text" },
      { name: "recurring_count", type: "number" },
      { name: "recurring_period_days", type: "number" },
      { name: "total_committed_amount", type: "number" },
      { name: "status", type: "select", maxSelect: 1, values: ["pending", "awaiting_3d", "awaiting_subscription_confirmation", "success", "failed"] },
      { name: "nkolay_payment_id", type: "text" },
      { name: "installment", type: "number" },
      { name: "foreign_card", type: "bool" },
      { name: "payment_mode", type: "select", maxSelect: 1, values: ["3d", "2d"] },
      { name: "error_code", type: "text" },
      { name: "error_message", type: "text" }
    ],
    indexes: [
      "CREATE INDEX idx_transactions_status ON transactions (status)",
      "CREATE UNIQUE INDEX idx_transactions_client_ref ON transactions (client_ref_code)"
    ]
  }))

  save(new Collection({
    type: "base",
    name: "subscriptions",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "donor", type: "relation", collectionId: donors.id, maxSelect: 1 },
      { name: "transaction", type: "relation", collectionId: transactions.id, maxSelect: 1 },
      { name: "nkolay_instruction_id", type: "text", required: true },
      { name: "amount", type: "number", required: true },
      { name: "installment_count", type: "number" },
      { name: "installment_period_days", type: "number" },
      { name: "total_committed_amount", type: "number" },
      { name: "status", type: "select", maxSelect: 1, values: ["pending", "active", "failed", "cancelled"] },
      { name: "next_payment_date", type: "text" },
      { name: "failure_reason", type: "text" }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_subscriptions_instruction ON subscriptions (nkolay_instruction_id)"
    ]
  }))

  save(new Collection({
    type: "base",
    name: "payment_events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "transaction", type: "relation", collectionId: transactions.id, maxSelect: 1 },
      { name: "type", type: "text", required: true },
      { name: "provider", type: "select", maxSelect: 1, values: ["nkolay", "system"] },
      { name: "payload", type: "json" },
      { name: "created_at", type: "date" }
    ],
    indexes: [
      "CREATE INDEX idx_payment_events_type ON payment_events (type)"
    ]
  }))

  save(new Collection({
    type: "base",
    name: "iban_accounts",
    listRule: "",
    viewRule: "",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { name: "bank_name", type: "text", required: true },
      { name: "account_name", type: "text", required: true },
      { name: "iban", type: "text", required: true },
      { name: "currency", type: "text" },
      { name: "active", type: "bool" },
      { name: "sort_order", type: "number" }
    ],
    indexes: [
      "CREATE INDEX idx_iban_active_sort ON iban_accounts (active, sort_order)"
    ]
  }))
}, (app) => {
  for (const name of ["iban_accounts", "payment_events", "subscriptions", "transactions", "donors"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // no-op
    }
  }
})
