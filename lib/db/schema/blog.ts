import {
  pgTable, uuid, text, varchar, boolean,
  timestamp, integer, jsonb, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core"
import { users } from "./users"

// "scheduled" is a third state on purpose, rather than publishing with a future date and hiding it
// by date. EIGHT separate places decide whether a post is public and every one checks only the
// status — the public list, the article page, both comment routes, the blog API, the single-post
// API, the cover-image file proxy and the sitemap. A future-dated "published" post would have
// needed a date check added to all eight, and missing one leaks the article early (the sitemap
// would hand it to Google; the file route would serve its cover image). A scheduled post simply
// isn't "published", so all eight keep hiding it with no changes at all.
export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "scheduled", "published"])

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    excerpt: text("excerpt"),
    content: text("content").notNull().default(""),   // HTML output from Tiptap
    coverImageUrl: text("cover_image_url"),
    authorId: text("author_id").notNull().references(() => users.id),
    authorName: varchar("author_name", { length: 160 }), // optional display name; falls back to the author's account name
    status: blogPostStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // When a scheduled post should go live. The sweep stamps published_at with THIS value rather
    // than its own run time, so ordering matches what the admin actually chose instead of drifting
    // by however long the sweep took to notice.
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    allowComments: boolean("allow_comments").notNull().default(true),
    allowSharing: boolean("allow_sharing").notNull().default(true),
    category: varchar("category", { length: 100 }),
    tags: jsonb("tags").$type<string[]>().default([]),
    readTimeMinutes: integer("read_time_minutes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_idx").on(t.slug),
    index("blog_posts_status_idx").on(t.status),
    index("blog_posts_author_idx").on(t.authorId),
    index("blog_posts_published_at_idx").on(t.publishedAt),
  ]
)

export const blogComments = pgTable(
  "blog_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => blogPosts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(),
    isApproved: boolean("is_approved").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("blog_comments_post_idx").on(t.postId),
    index("blog_comments_user_idx").on(t.userId),
  ]
)

export type BlogPost = typeof blogPosts.$inferSelect
export type NewBlogPost = typeof blogPosts.$inferInsert
export type BlogComment = typeof blogComments.$inferSelect
export type NewBlogComment = typeof blogComments.$inferInsert
