import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106190519 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "pagina_negozio" drop constraint if exists "pagina_negozio_percorso_unique";`);
    this.addSql(`create table if not exists "pagina_negozio" ("id" text not null, "titolo" text not null, "percorso" text not null, "testo" text not null default '', "visibile" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "pagina_negozio_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_pagina_negozio_percorso_unique" ON "pagina_negozio" ("percorso") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_pagina_negozio_deleted_at" ON "pagina_negozio" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "vetrina_negozio" ("id" text not null, "testata" text not null default 'Ishtar Lab', "annuncio" text not null default '', "accento" text check ("accento" in ('rosa', 'mare', 'sabbia')) not null default 'rosa', "messaggio" text not null default '', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "vetrina_negozio_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_vetrina_negozio_deleted_at" ON "vetrina_negozio" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "pagina_negozio" cascade;`);

    this.addSql(`drop table if exists "vetrina_negozio" cascade;`);
  }

}
