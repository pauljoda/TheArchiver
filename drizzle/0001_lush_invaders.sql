CREATE TABLE `installed_plugins` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`version` text DEFAULT '1.0.0' NOT NULL,
	`description` text,
	`author` text,
	`url_patterns` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`has_settings` integer DEFAULT false NOT NULL,
	`installed_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`group` text NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`default_value` text,
	`validation` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
