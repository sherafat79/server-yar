CREATE TABLE `certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hostname` text NOT NULL,
	`notes` text,
	`ssl_expires_at` text,
	`ssl_issuer` text,
	`last_checked_at` text,
	`last_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_hostname_unique` ON `certificates` (`hostname`);--> statement-breakpoint
CREATE TABLE `locations` (
	`name` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `locations` (`name`)
SELECT DISTINCT trim(`location`) FROM `servers`
WHERE `location` IS NOT NULL AND trim(`location`) <> '';
