import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106173913 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "outfit" ("id" text not null, "nome" text not null, "descrizione" text null, "stato" text check ("stato" in ('bozza', 'pubblicato', 'archiviato')) not null default 'bozza', "modalita_prezzo" text check ("modalita_prezzo" in ('somma', 'fisso')) not null default 'somma', "prezzo_fisso" numeric null, "sconto_a_carico" text check ("sconto_a_carico" in ('negozio', 'aziende', 'ripartito')) not null default 'negozio', "quota_negozio" integer not null default 100, "pubblicato_il" timestamptz null, "raw_prezzo_fisso" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "outfit_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_outfit_deleted_at" ON "outfit" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "capo_outfit" ("id" text not null, "outfit_id" text not null, "product_id" text not null, "azienda_id" text not null, "alternativa_product_id" text null, "alternativa_azienda_id" text null, "x" real not null default 0, "y" real not null default 0, "larghezza" real not null default 40, "livello" integer not null default 1, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "capo_outfit_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_capo_outfit_outfit_id" ON "capo_outfit" ("outfit_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_capo_outfit_deleted_at" ON "capo_outfit" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_capo_outfit_product_id" ON "capo_outfit" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_capo_outfit_azienda_id" ON "capo_outfit" ("azienda_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_capo_outfit_alternativa_azienda_id" ON "capo_outfit" ("alternativa_azienda_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "capo_outfit" add constraint "capo_outfit_outfit_id_foreign" foreign key ("outfit_id") references "outfit" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "capo_outfit" drop constraint if exists "capo_outfit_outfit_id_foreign";`);

    this.addSql(`drop table if exists "outfit" cascade;`);

    this.addSql(`drop table if exists "capo_outfit" cascade;`);
  }

}
