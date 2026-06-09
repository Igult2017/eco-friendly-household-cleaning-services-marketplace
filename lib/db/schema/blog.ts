import {
  pgTable, uuid, text, varchar, boolean,
  timestamp, integer, jsonb, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core"
import { users } from "./users"

export const blogPostStatusEnum = pgEnum("blog_post_status", ["draft", "published"])

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
    status: blogPostStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
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
