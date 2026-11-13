import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261113133526 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "messaggio_cliente" drop constraint if exists "messaggio_cliente_chiave_unica_unique";`);
    this.addSql(`alter table if exists "identita_contatto" drop constraint if exists "identita_contatto_canale_account_id_contatto_unique";`);
    this.addSql(`create table if not exists "identita_contatto" ("id" text not null, "canale" text check ("canale" in ('telegram', 'email', 'sito', 'whatsapp', 'instagram', 'messenger')) not null, "account" text not null, "id_contatto" text not null, "nome" text null, "recapito" text null, "cliente_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "identita_contatto_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_identita_contatto_deleted_at" ON "identita_contatto" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_identita_contatto_canale_account_id_contatto_unique" ON "identita_contatto" ("canale", "account", "id_contatto") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_identita_contatto_cliente_id" ON "identita_contatto" ("cliente_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "conversazione_cliente" ("id" text not null, "canale" text check ("canale" in ('telegram', 'email', 'sito', 'whatsapp', 'instagram', 'messenger')) not null, "identita_id" text not null, "stato" text check ("stato" in ('aperta', 'in_attesa', 'chiusa')) not null default 'aperta', "oggetto" text null, "ultimo_messaggio_il" timestamptz not null, "ultimo_estratto" text not null, "non_letti" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "conversazione_cliente_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversazione_cliente_identita_id" ON "conversazione_cliente" ("identita_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversazione_cliente_deleted_at" ON "conversazione_cliente" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversazione_cliente_stato" ON "conversazione_cliente" ("stato") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_conversazione_cliente_ultimo_messaggio_il" ON "conversazione_cliente" ("ultimo_messaggio_il") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "messaggio_cliente" ("id" text not null, "conversazione_id" text not null, "direzione" text check ("direzione" in ('entrata', 'uscita')) not null, "testo" text not null, "quando" timestamptz not null, "chiave_unica" text not null, "id_esterno" text null, "stato_consegna" text check ("stato_consegna" in ('ricevuto', 'in_coda', 'inviato', 'fallito', 'incerto')) not null, "tentato_il" timestamptz null, "errore" text null, "autore_id" text null, "autore_nome" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "messaggio_cliente_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_messaggio_cliente_conversazione_id" ON "messaggio_cliente" ("conversazione_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_messaggio_cliente_deleted_at" ON "messaggio_cliente" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_messaggio_cliente_chiave_unica_unique" ON "messaggio_cliente" ("chiave_unica") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "risposta_rapida" ("id" text not null, "titolo" text not null, "testo" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "risposta_rapida_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_risposta_rapida_deleted_at" ON "risposta_rapida" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "conversazione_cliente" add constraint "conversazione_cliente_identita_id_foreign" foreign key ("identita_id") references "identita_contatto" ("id") on update cascade;`);

    this.addSql(`alter table if exists "messaggio_cliente" add constraint "messaggio_cliente_conversazione_id_foreign" foreign key ("conversazione_id") references "conversazione_cliente" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "conversazione_cliente" drop constraint if exists "conversazione_cliente_identita_id_foreign";`);

    this.addSql(`alter table if exists "messaggio_cliente" drop constraint if exists "messaggio_cliente_conversazione_id_foreign";`);

    this.addSql(`drop table if exists "identita_contatto" cascade;`);

    this.addSql(`drop table if exists "conversazione_cliente" cascade;`);

    this.addSql(`drop table if exists "messaggio_cliente" cascade;`);

    this.addSql(`drop table if exists "risposta_rapida" cascade;`);
  }

}
