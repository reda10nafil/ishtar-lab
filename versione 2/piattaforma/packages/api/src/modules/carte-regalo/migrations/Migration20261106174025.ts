import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106174025 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "carta_regalo" drop constraint if exists "carta_regalo_codice_unique";`);
    this.addSql(`create table if not exists "carta_regalo" ("id" text not null, "codice" text not null, "importo_iniziale" numeric not null, "saldo" numeric not null, "valuta" text not null default 'eur', "scadenza" timestamptz null, "stato" text check ("stato" in ('attiva', 'annullata')) not null default 'attiva', "destinatario_nome" text null, "destinatario_email" text null, "nota" text null, "annullata_il" timestamptz null, "motivo_annullamento" text null, "raw_importo_iniziale" jsonb not null, "raw_saldo" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "carta_regalo_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_carta_regalo_codice_unique" ON "carta_regalo" ("codice") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_carta_regalo_deleted_at" ON "carta_regalo" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "movimento_carta" ("id" text not null, "tipo" text check ("tipo" in ('emissione', 'rettifica', 'annullamento')) not null, "importo" numeric not null, "saldo_dopo" numeric not null, "nota" text null, "attore" text not null, "carta_id" text not null, "raw_importo" jsonb not null, "raw_saldo_dopo" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "movimento_carta_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_movimento_carta_carta_id" ON "movimento_carta" ("carta_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_movimento_carta_deleted_at" ON "movimento_carta" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "proposta_sconto" ("id" text not null, "azienda_id" text not null, "titolo" text not null, "tipo" text check ("tipo" in ('percentuale', 'importo')) not null, "valore" numeric not null, "inizio" timestamptz not null, "fine" timestamptz not null, "motivo" text not null, "prodotti" text[] null, "stato" text check ("stato" in ('in_attesa', 'approvata', 'rifiutata')) not null default 'in_attesa', "nota" text null, "deciso_da" text null, "deciso_il" timestamptz null, "promozione_id" text null, "codice" text null, "raw_valore" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "proposta_sconto_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_proposta_sconto_deleted_at" ON "proposta_sconto" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_proposta_sconto_azienda_id" ON "proposta_sconto" ("azienda_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_proposta_sconto_stato" ON "proposta_sconto" ("stato") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "movimento_carta" add constraint "movimento_carta_carta_id_foreign" foreign key ("carta_id") references "carta_regalo" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "movimento_carta" drop constraint if exists "movimento_carta_carta_id_foreign";`);

    this.addSql(`drop table if exists "carta_regalo" cascade;`);

    this.addSql(`drop table if exists "movimento_carta" cascade;`);

    this.addSql(`drop table if exists "proposta_sconto" cascade;`);
  }

}
