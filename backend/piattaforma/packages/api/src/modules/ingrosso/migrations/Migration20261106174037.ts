import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106174037 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "rivenditore" ("id" text not null, "nome" text not null, "referente" text null, "email" text null, "telefono" text null, "partita_iva" text null, "indirizzo" text null, "citta" text null, "cap" text null, "paese" text not null default 'it', "condizione" text check ("condizione" in ('listino', 'sconto')) not null default 'sconto', "listino" text null, "sconto_percentuale" numeric null, "pagamento" text null, "ordine_minimo" numeric null, "appunti" text null, "raw_sconto_percentuale" jsonb null, "raw_ordine_minimo" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "rivenditore_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_rivenditore_deleted_at" ON "rivenditore" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "trattativa" ("id" text not null, "titolo" text not null, "fase" text check ("fase" in ('richiesta', 'trattativa', 'campione', 'accordo', 'perso')) not null default 'richiesta', "posizione" integer not null default 0, "valore_stimato" numeric null, "ordine_id" text null, "rivenditore_id" text not null, "raw_valore_stimato" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "trattativa_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_trattativa_rivenditore_id" ON "trattativa" ("rivenditore_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_trattativa_deleted_at" ON "trattativa" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "nota_trattativa" ("id" text not null, "testo" text not null, "autore" text not null, "trattativa_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "nota_trattativa_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_nota_trattativa_trattativa_id" ON "nota_trattativa" ("trattativa_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_nota_trattativa_deleted_at" ON "nota_trattativa" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "trattativa" add constraint "trattativa_rivenditore_id_foreign" foreign key ("rivenditore_id") references "rivenditore" ("id") on update cascade;`);

    this.addSql(`alter table if exists "nota_trattativa" add constraint "nota_trattativa_trattativa_id_foreign" foreign key ("trattativa_id") references "trattativa" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "trattativa" drop constraint if exists "trattativa_rivenditore_id_foreign";`);

    this.addSql(`alter table if exists "nota_trattativa" drop constraint if exists "nota_trattativa_trattativa_id_foreign";`);

    this.addSql(`drop table if exists "rivenditore" cascade;`);

    this.addSql(`drop table if exists "trattativa" cascade;`);

    this.addSql(`drop table if exists "nota_trattativa" cascade;`);
  }

}
