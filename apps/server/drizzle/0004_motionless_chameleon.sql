ALTER TABLE `services` ADD `price` real;--> statement-breakpoint
ALTER TABLE `services` ADD `currency` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `billing_cycle` text DEFAULT 'monthly' NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `next_renewal` text;