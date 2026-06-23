import {
  pgTable,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  uuid,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core"
import { users } from "./users"

// Lifecycle steps: welcome (auto on signup) → value ×2 → soft_sell → hard_sell. custom = ad-hoc blast.
export const emailCampaignTypeEnum = pgEnum("email_campaign_type", [
  "welcome",
  "value",
  "soft_sell",
  "hard_sell",
  "custom",
])

export const emailCampaignStatusEnum = pgEnum("email_campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "completed",
  "failed",
])

export const emailSendStatusEnum = pgEnum("email_send_status", [
  "queued",
  "sent",
  "delivered",
  "opened",
  "bounced",
  "failed",
  "skipped",
])

// A campaign = one admin-composed send (a lifecycle step to a segment, or a custom blast).
export const emailCampaigns = pgTable(
  "email_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    type: emailCampaignTypeEnum("type").notNull().default("custom"),
    status: emailCampaignStatusEnum("status").notNull().default("draft"),
    subject: varchar("subject", { length: 240 }), // base subject; AI may personalize per user
    brief: text("brief"), // admin's intent — feeds the Gemini prompt
    bodyHtml: text("body_html"), // base/preview body (AI personalizes per recipient when enabled)
    aiGenerated: boolean("ai_generated").notNull().default(false),
    personalizePerUser: boolean("personalize_per_user").notNull().default(true), // unique copy per recipient (anti-spam)
    audience: jsonb("audience"), // segment filter: { role, signedUpWithinDays, onlyConsented, hasBooked, ... }
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    createdBy: text("created_by").references(() => users.id),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_campaigns_status_idx").on(t.status),
    index("email_campaigns_type_idx").on(t.type),
  ]
)

// One row per recipient per campaign — delivery log + lifecycle tracking + dedupe.
export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").references(() => emailCampaigns.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    type: emailCampaignTypeEnum("type").notNull(), // which lifecycle step this send was
    status: emailSendStatusEnum("status").notNull().default("queued"),
    subject: varchar("subject", { length: 240 }),
    resendMessageId: varchar("resend_message_id", { length: 120 }),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Dedupe a campaign per user (NULL campaign_id = lifecycle/welcome sends, deduped in code by type).
    uniqueIndex("email_sends_campaign_user_idx").on(t.campaignId, t.userId),
    index("email_sends_user_idx").on(t.userId),
    index("email_sends_type_idx").on(t.type),
  ]
)

export type EmailCampaign = typeof emailCampaigns.$inferSelect
export type NewEmailCampaign = typeof emailCampaigns.$inferInsert
export type EmailSend = typeof emailSends.$inferSelect
export type NewEmailSend = typeof emailSends.$inferInsert
