import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

const id = (name = "id") =>
  text(name, { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const metadata = () =>
  text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .default({})
    .notNull();

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const timestampNow = (name: string) => timestamp(name).defaultNow().notNull();

export const commentStatus = ["pending", "approved", "rejected", "spam", "deleted"] as const;

export const newsletterSubscriberStatus = [
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced"
] as const;

export const newsletterDeliveryStatus = ["queued", "sent", "failed", "bounced"] as const;

export const postViewCounts = sqliteTable(
  "post_view_counts",
  {
    id: id(),
    entryId: text("entry_id", { length: 512 }).notNull(),
    entryLocale: text("entry_locale", { length: 16 }),
    totalViews: integer("total_views").default(0).notNull(),
    uniqueViews: integer("unique_views").default(0).notNull(),
    lastViewedAt: timestamp("last_viewed_at"),
    metadata: metadata(),
    createdAt: timestampNow("created_at"),
    updatedAt: timestampNow("updated_at")
  },
  (table) => [
    uniqueIndex("post_view_counts_entry_unique").on(table.entryId, table.entryLocale),
    index("post_view_counts_total_views_idx").on(table.totalViews),
    check("post_view_counts_entry_id_not_blank", sql`length(trim(entry_id)) > 0`),
    check("post_view_counts_total_views_non_negative", sql`total_views >= 0`),
    check("post_view_counts_unique_views_non_negative", sql`unique_views >= 0`)
  ]
);

export const postViewEvents = sqliteTable(
  "post_view_events",
  {
    id: id(),
    entryId: text("entry_id", { length: 512 }).notNull(),
    entryLocale: text("entry_locale", { length: 16 }),
    visitorHash: text("visitor_hash", { length: 128 }),
    referrer: text("referrer", { length: 2048 }),
    userAgent: text("user_agent"),
    metadata: metadata(),
    viewedAt: timestampNow("viewed_at")
  },
  (table) => [
    index("post_view_events_entry_idx").on(table.entryId, table.entryLocale, table.viewedAt),
    index("post_view_events_visitor_idx").on(table.visitorHash),
    check("post_view_events_entry_id_not_blank", sql`length(trim(entry_id)) > 0`)
  ]
);

export const comments = sqliteTable(
  "comments",
  {
    id: id(),
    entryId: text("entry_id", { length: 512 }).notNull(),
    entryLocale: text("entry_locale", { length: 16 }),
    parentId: text("parent_id", { length: 36 }).references((): AnySQLiteColumn => comments.id, {
      onDelete: "set null"
    }),
    authorName: text("author_name", { length: 80 }).notNull(),
    authorEmailHash: text("author_email_hash", { length: 128 }),
    authorWebsite: text("author_website", { length: 2048 }),
    body: text("body").notNull(),
    status: text("status", { enum: commentStatus }).default("pending").notNull(),
    isPinned: integer("is_pinned", { mode: "boolean" }).default(false).notNull(),
    ipHash: text("ip_hash", { length: 128 }),
    userAgent: text("user_agent"),
    metadata: metadata(),
    createdAt: timestampNow("created_at"),
    updatedAt: timestampNow("updated_at"),
    approvedAt: timestamp("approved_at"),
    deletedAt: timestamp("deleted_at")
  },
  (table) => [
    index("comments_entry_idx").on(table.entryId, table.entryLocale, table.createdAt),
    index("comments_parent_idx").on(table.parentId),
    index("comments_status_idx").on(table.status),
    check("comments_entry_id_not_blank", sql`length(trim(entry_id)) > 0`),
    check("comments_body_not_blank", sql`length(trim(body)) > 0`),
    check("comments_author_name_not_blank", sql`length(trim(author_name)) > 0`)
  ]
);

export const newsletterSubscribers = sqliteTable(
  "newsletter_subscribers",
  {
    id: id(),
    email: text("email", { length: 320 }).notNull(),
    status: text("status", { enum: newsletterSubscriberStatus }).default("pending").notNull(),
    source: text("source", { length: 120 }),
    locale: text("locale", { length: 16 }),
    verificationTokenHash: text("verification_token_hash", { length: 128 }),
    unsubscribeTokenHash: text("unsubscribe_token_hash", { length: 128 }),
    metadata: metadata(),
    subscribedAt: timestamp("subscribed_at"),
    unsubscribedAt: timestamp("unsubscribed_at"),
    bouncedAt: timestamp("bounced_at"),
    createdAt: timestampNow("created_at"),
    updatedAt: timestampNow("updated_at")
  },
  (table) => [
    uniqueIndex("newsletter_subscribers_email_unique").on(sql`lower(email)`),
    index("newsletter_subscribers_status_idx").on(table.status),
    check("newsletter_subscribers_email_not_blank", sql`length(trim(email)) > 0`)
  ]
);

export const newsletterIssues = sqliteTable(
  "newsletter_issues",
  {
    id: id(),
    subject: text("subject", { length: 240 }).notNull(),
    previewText: text("preview_text", { length: 300 }),
    bodyMarkdown: text("body_markdown"),
    bodyHtml: text("body_html"),
    contentUrl: text("content_url", { length: 2048 }),
    metadata: metadata(),
    createdAt: timestampNow("created_at"),
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at")
  },
  (table) => [
    index("newsletter_issues_scheduled_idx").on(table.scheduledAt),
    check("newsletter_issues_subject_not_blank", sql`length(trim(subject)) > 0`)
  ]
);

export const newsletterDeliveries = sqliteTable(
  "newsletter_deliveries",
  {
    id: id(),
    issueId: text("issue_id", { length: 36 })
      .notNull()
      .references(() => newsletterIssues.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id", { length: 36 })
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    status: text("status", { enum: newsletterDeliveryStatus }).default("queued").notNull(),
    providerMessageId: text("provider_message_id", { length: 255 }),
    errorMessage: text("error_message"),
    attempts: integer("attempts").default(0).notNull(),
    queuedAt: timestampNow("queued_at"),
    sentAt: timestamp("sent_at"),
    failedAt: timestamp("failed_at"),
    bouncedAt: timestamp("bounced_at")
  },
  (table) => [
    uniqueIndex("newsletter_deliveries_issue_subscriber_unique").on(table.issueId, table.subscriberId),
    index("newsletter_deliveries_status_idx").on(table.status),
    index("newsletter_deliveries_subscriber_idx").on(table.subscriberId),
    check("newsletter_deliveries_attempts_non_negative", sql`attempts >= 0`)
  ]
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_replies"
  }),
  replies: many(comments, {
    relationName: "comment_replies"
  })
}));

export const newsletterSubscribersRelations = relations(newsletterSubscribers, ({ many }) => ({
  deliveries: many(newsletterDeliveries)
}));

export const newsletterIssuesRelations = relations(newsletterIssues, ({ many }) => ({
  deliveries: many(newsletterDeliveries)
}));

export const newsletterDeliveriesRelations = relations(newsletterDeliveries, ({ one }) => ({
  issue: one(newsletterIssues, {
    fields: [newsletterDeliveries.issueId],
    references: [newsletterIssues.id]
  }),
  subscriber: one(newsletterSubscribers, {
    fields: [newsletterDeliveries.subscriberId],
    references: [newsletterSubscribers.id]
  })
}));

export type CommentStatus = (typeof commentStatus)[number];
export type NewsletterSubscriberStatus = (typeof newsletterSubscriberStatus)[number];
export type NewsletterDeliveryStatus = (typeof newsletterDeliveryStatus)[number];
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PostViewCount = typeof postViewCounts.$inferSelect;
export type NewPostViewCount = typeof postViewCounts.$inferInsert;
export type PostViewEvent = typeof postViewEvents.$inferSelect;
export type NewPostViewEvent = typeof postViewEvents.$inferInsert;
export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewNewsletterSubscriber = typeof newsletterSubscribers.$inferInsert;
export type NewsletterIssue = typeof newsletterIssues.$inferSelect;
export type NewNewsletterIssue = typeof newsletterIssues.$inferInsert;
export type NewsletterDelivery = typeof newsletterDeliveries.$inferSelect;
export type NewNewsletterDelivery = typeof newsletterDeliveries.$inferInsert;
