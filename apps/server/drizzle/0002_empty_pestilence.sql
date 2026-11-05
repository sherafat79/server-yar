CREATE TABLE `registrars` (
	`name` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `registrars` (`name`)
SELECT DISTINCT trim(`registrar`) FROM `domains`
WHERE `registrar` IS NOT NULL AND trim(`registrar`) <> '';
