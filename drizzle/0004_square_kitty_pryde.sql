CREATE TABLE `scheduled_urls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`cron_expression` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
