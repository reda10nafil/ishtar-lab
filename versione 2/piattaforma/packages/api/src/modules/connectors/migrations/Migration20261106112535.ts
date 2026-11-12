import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106112535 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "oauth_state" drop constraint if exists "oauth_state_state_hash_unique";`);
    this.addSql(`alter table if exists "connector_account" drop constraint if exists "connector_account_provider_unique";`);
    this.addSql(`create table if not exists "connector_account" ("id" text not null, "provider" text not null, "status" text check ("status" in ('da_collegare', 'collegato', 'errore')) not null default 'da_collegare', "account_label" text null, "secret" text not null, "expires_at" timestamptz null, "last_checked_at" timestamptz null, "last_error" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "connector_account_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_connector_account_provider_unique" ON "connector_account" ("provider") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_connector_account_deleted_at" ON "connector_account" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "oauth_state" ("id" text not null, "provider" text not null, "state_hash" text not null, "verifier" text not null, "expires_at" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "oauth_state_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_oauth_state_state_hash_unique" ON "oauth_state" ("state_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_oauth_state_deleted_at" ON "oauth_state" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "connector_account" cascade;`);

    this.addSql(`drop table if exists "oauth_state" cascade;`);
  }

}
