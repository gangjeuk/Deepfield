CREATE TABLE `comments` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`entry_id` text(512) NOT NULL,
	`entry_locale` text(16),
	`parent_id` text(36),
	`author_name` text(80) NOT NULL,
	`author_email_hash` text(128),
	`author_website` text(2048),
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`ip_hash` text(128),
	`user_agent` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`approved_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "comments_entry_id_not_blank" CHECK(length(trim(entry_id)) > 0),
	CONSTRAINT "comments_body_not_blank" CHECK(length(trim(body)) > 0),
	CONSTRAINT "comments_author_name_not_blank" CHECK(length(trim(author_name)) > 0)
);
--> statement-breakpoint
CREATE INDEX `comments_entry_idx` ON `comments` (`entry_id`,`entry_locale`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_parent_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_status_idx` ON `comments` (`status`);--> statement-breakpoint
CREATE TABLE `newsletter_deliveries` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`issue_id` text(36) NOT NULL,
	`subscriber_id` text(36) NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`provider_message_id` text(255),
	`error_message` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`queued_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`sent_at` integer,
	`failed_at` integer,
	`bounced_at` integer,
	FOREIGN KEY (`issue_id`) REFERENCES `newsletter_issues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subscriber_id`) REFERENCES `newsletter_subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "newsletter_deliveries_attempts_non_negative" CHECK(attempts >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_deliveries_issue_subscriber_unique` ON `newsletter_deliveries` (`issue_id`,`subscriber_id`);--> statement-breakpoint
CREATE INDEX `newsletter_deliveries_status_idx` ON `newsletter_deliveries` (`status`);--> statement-breakpoint
CREATE INDEX `newsletter_deliveries_subscriber_idx` ON `newsletter_deliveries` (`subscriber_id`);--> statement-breakpoint
CREATE TABLE `newsletter_issues` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`subject` text(240) NOT NULL,
	`preview_text` text(300),
	`body_markdown` text,
	`body_html` text,
	`content_url` text(2048),
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`scheduled_at` integer,
	`sent_at` integer,
	CONSTRAINT "newsletter_issues_subject_not_blank" CHECK(length(trim(subject)) > 0)
);
--> statement-breakpoint
CREATE INDEX `newsletter_issues_scheduled_idx` ON `newsletter_issues` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`email` text(320) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`source` text(120),
	`locale` text(16),
	`verification_token_hash` text(128),
	`unsubscribe_token_hash` text(128),
	`metadata` text DEFAULT '{}' NOT NULL,
	`subscribed_at` integer,
	`unsubscribed_at` integer,
	`bounced_at` integer,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "newsletter_subscribers_email_not_blank" CHECK(length(trim(email)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (lower(email));--> statement-breakpoint
CREATE INDEX `newsletter_subscribers_status_idx` ON `newsletter_subscribers` (`status`);--> statement-breakpoint
CREATE TABLE `post_view_counts` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`entry_id` text(512) NOT NULL,
	`entry_locale` text(16),
	`total_views` integer DEFAULT 0 NOT NULL,
	`unique_views` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` integer,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "post_view_counts_entry_id_not_blank" CHECK(length(trim(entry_id)) > 0),
	CONSTRAINT "post_view_counts_total_views_non_negative" CHECK(total_views >= 0),
	CONSTRAINT "post_view_counts_unique_views_non_negative" CHECK(unique_views >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_view_counts_entry_unique` ON `post_view_counts` (`entry_id`,`entry_locale`);--> statement-breakpoint
CREATE INDEX `post_view_counts_total_views_idx` ON `post_view_counts` (`total_views`);--> statement-breakpoint
CREATE TABLE `post_view_events` (
	`id` text(36) PRIMARY KEY NOT NULL,
	`entry_id` text(512) NOT NULL,
	`entry_locale` text(16),
	`visitor_hash` text(128),
	`referrer` text(2048),
	`user_agent` text,
	`metadata` text DEFAULT '{}' NOT NULL,
	`viewed_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)) NOT NULL,
	CONSTRAINT "post_view_events_entry_id_not_blank" CHECK(length(trim(entry_id)) > 0)
);
--> statement-breakpoint
CREATE INDEX `post_view_events_entry_idx` ON `post_view_events` (`entry_id`,`entry_locale`,`viewed_at`);--> statement-breakpoint
CREATE INDEX `post_view_events_visitor_idx` ON `post_view_events` (`visitor_hash`);