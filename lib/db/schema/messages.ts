import { pgTable, uuid, text, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { bookings } from "./bookings"
import { users } from "./users"

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One of bookingId / jobPostId is set: booking chat, or the job-level chat that opens between the
  // client and the ACCEPTED cleaner the moment a bid is accepted (before payment/booking exist).
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  jobPostId: uuid("job_post_id"),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  attachmentUrl: text("attachment_url"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("messages_booking_idx").on(t.bookingId),
  index("messages_created_at_idx").on(t.createdAt),
])

export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
