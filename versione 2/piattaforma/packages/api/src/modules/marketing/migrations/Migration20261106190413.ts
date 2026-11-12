import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106190413 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "consegna_marketing" drop constraint if exists "consegna_marketing_origine_cliente_id_unique";`);
    this.addSql(`alter table if exists "automazione_marketing" drop constraint if exists "automazione_marketing_chiave_unique";`);
    this.addSql(`create table if not exists "automazione_marketing" ("id" text not null, "chiave" text not null, "attiva" boolean not null default false, "oggetto" text not null, "testo" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "automazione_marketing_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_automazione_marketing_chiave_unique" ON "automazione_marketing" ("chiave") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_automazione_marketing_deleted_at" ON "automazione_marketing" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "campagna_marketing" ("id" text not null, "nome" text not null, "canale" text check ("canale" in ('email')) not null default 'email', "oggetto" text not null, "testo" text not null, "pubblico" text not null default 'tutti', "stato" text check ("stato" in ('bozza', 'programmata', 'in_invio', 'inviata', 'fallita')) not null default 'bozza', "programmata_il" timestamptz null, "avviata_il" timestamptz null, "conclusa_il" timestamptz null, "destinatari" integer not null default 0, "inviati" integer not null default 0, "falliti" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "campagna_marketing_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_campagna_marketing_deleted_at" ON "campagna_marketing" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_campagna_marketing_stato" ON "campagna_marketing" ("stato") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "consegna_marketing" ("id" text not null, "origine" text not null, "cliente_id" text not null, "email" text not null, "stato" text check ("stato" in ('inviato', 'fallito')) not null, "errore" text null, "inviata_il" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "consegna_marketing_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consegna_marketing_deleted_at" ON "consegna_marketing" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_consegna_marketing_origine_cliente_id_unique" ON "consegna_marketing" ("origine", "cliente_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_consegna_marketing_origine" ON "consegna_marketing" ("origine") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "automazione_marketing" cascade;`);

    this.addSql(`drop table if exists "campagna_marketing" cascade;`);

    this.addSql(`drop table if exists "consegna_marketing" cascade;`);
  }

}
