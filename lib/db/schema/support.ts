import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users"

// In-app support channel: ONE ongoing thread per user (client or cleaner) with the DORIXÉ team.
export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // thread owner
    senderId: text("sender_id").notNull(), // the owner, or the admin who replied
    fromAdmin: boolean("from_admin").notNull().default(false),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false), // read by the RECIPIENT side
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("support_messages_user_idx").on(t.userId), index("support_messages_created_idx").on(t.createdAt)],
)

export type SupportMessage = typeof supportMessages.$inferSelect
