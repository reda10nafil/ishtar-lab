import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261113190639 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "cursore_canale" drop constraint if exists "cursore_canale_canale_account_cartella_unique";`);
    this.addSql(`create table if not exists "cursore_canale" ("id" text not null, "canale" text not null, "account" text not null, "cartella" text not null, "uidvalidity" text not null, "ultimo_uid" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "cursore_canale_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_cursore_canale_deleted_at" ON "cursore_canale" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cursore_canale_canale_account_cartella_unique" ON "cursore_canale" ("canale", "account", "cartella") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "messaggio_cliente" add column if not exists "dettagli" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "cursore_canale" cascade;`);

    this.addSql(`alter table if exists "messaggio_cliente" drop column if exists "dettagli";`);
  }

}
