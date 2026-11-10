ALTER TABLE `servers` ADD `alert_delay_min` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `servers` ADD `down_alerted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `alert_delay_min` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `down_alerted` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `servers` SET `down_alerted` = 1 WHERE `status` = 'down';--> statement-breakpoint
UPDATE `services` SET `down_alerted` = 1 WHERE `status` = 'down';
