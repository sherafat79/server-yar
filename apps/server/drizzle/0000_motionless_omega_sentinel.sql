CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` integer,
	`summary` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_created` ON `activity` (`created_at`);--> statement-breakpoint
CREATE TABLE `checks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`ts` integer NOT NULL,
	`ok` integer NOT NULL,
	`latency_ms` integer
);
--> statement-breakpoint
CREATE INDEX `checks_target_ts` ON `checks` (`target_type`,`target_id`,`ts`);--> statement-breakpoint
CREATE INDEX `checks_ts` ON `checks` (`ts`);--> statement-breakpoint
CREATE TABLE `checks_hourly` (
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`hour` integer NOT NULL,
	`total` integer NOT NULL,
	`ok_count` integer NOT NULL,
	`avg_ms` real,
	PRIMARY KEY(`target_type`, `target_id`, `hour`)
);
--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`registrar` text,
	`vendor_id` integer,
	`expires_at` text,
	`price` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`auto_renew` integer DEFAULT false NOT NULL,
	`check_ssl` integer DEFAULT true NOT NULL,
	`notes` text,
	`ssl_expires_at` text,
	`ssl_issuer` text,
	`whois_expires_at` text,
	`last_whois_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `domains_name_unique` ON `domains` (`name`);--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`started_at` text NOT NULL,
	`resolved_at` text,
	`cause` text
);
--> statement-breakpoint
CREATE INDEX `incidents_target` ON `incidents` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`paid_at` text NOT NULL,
	`period_from` text,
	`period_to` text,
	`note` text,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `providers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_name_unique` ON `providers` (`name`);--> statement-breakpoint
CREATE TABLE `sent_notifications` (
	`key` text PRIMARY KEY NOT NULL,
	`sent_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `servers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`ips` text DEFAULT '[]' NOT NULL,
	`provider_id` integer,
	`vendor_id` integer,
	`location` text,
	`os` text,
	`cpu` text,
	`ram` text,
	`disk` text,
	`traffic` text,
	`panel_url` text,
	`ssh_user` text,
	`ssh_port` integer,
	`ssh_password` text,
	`ssh_key` text,
	`panel_user` text,
	`panel_password` text,
	`price` real,
	`currency` text DEFAULT 'USD' NOT NULL,
	`billing_cycle` text DEFAULT 'monthly' NOT NULL,
	`next_renewal` text,
	`auto_renew` integer DEFAULT false NOT NULL,
	`monitor` integer DEFAULT true NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`archived` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`consecutive_fails` integer DEFAULT 0 NOT NULL,
	`last_checked_at` text,
	`latency_ms` integer,
	`last_error` text,
	`maintenance_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`server_id` integer,
	`domain_id` integer,
	`hostname` text,
	`port` integer,
	`check_method` text DEFAULT 'none' NOT NULL,
	`check_url` text,
	`check_keyword` text,
	`heartbeat_token` text,
	`heartbeat_grace_sec` integer DEFAULT 600 NOT NULL,
	`last_heartbeat_at` text,
	`path` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`consecutive_fails` integer DEFAULT 0 NOT NULL,
	`last_checked_at` text,
	`latency_ms` integer,
	`last_error` text,
	`ssl_expires_at` text,
	`maintenance_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`server_id`) REFERENCES `servers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `services_hb_token` ON `services` (`heartbeat_token`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`totp_secret` text,
	`totp_enabled` integer DEFAULT false NOT NULL,
	`totp_last_step` integer,
	`can_reveal_secrets` integer DEFAULT false NOT NULL,
	`telegram_chat_id` text,
	`telegram_link_code` text,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_name_unique` ON `vendors` (`name`);