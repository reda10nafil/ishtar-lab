import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106173134 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "preferenza_avvisi" drop constraint if exists "preferenza_avvisi_attore_tipo_attore_id_unique";`);
    this.addSql(`alter table if exists "avviso_letto" drop constraint if exists "avviso_letto_attore_tipo_attore_id_chiave_unique";`);
    this.addSql(`create table if not exists "avviso_letto" ("id" text not null, "attore_tipo" text not null, "attore_id" text not null, "chiave" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "avviso_letto_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_avviso_letto_deleted_at" ON "avviso_letto" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_avviso_letto_attore_tipo_attore_id_chiave_unique" ON "avviso_letto" ("attore_tipo", "attore_id", "chiave") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "preferenza_avvisi" ("id" text not null, "attore_tipo" text not null, "attore_id" text not null, "disattivate" jsonb not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "preferenza_avvisi_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_preferenza_avvisi_deleted_at" ON "preferenza_avvisi" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_preferenza_avvisi_attore_tipo_attore_id_unique" ON "preferenza_avvisi" ("attore_tipo", "attore_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "richiesta_assistenza" ("id" text not null, "oggetto" text not null, "categoria" text not null, "stato" text check ("stato" in ('aperta', 'in_attesa', 'chiusa')) not null default 'aperta', "azienda_id" text null, "autore_id" text not null, "autore_nome" text not null, "ultimo_messaggio_il" timestamptz not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "richiesta_assistenza_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_richiesta_assistenza_deleted_at" ON "richiesta_assistenza" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_richiesta_assistenza_azienda_id" ON "richiesta_assistenza" ("azienda_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_richiesta_assistenza_stato" ON "richiesta_assistenza" ("stato") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "messaggio_assistenza" ("id" text not null, "richiesta_id" text not null, "da_staff" boolean not null, "autore_id" text not null, "autore_nome" text not null, "testo" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "messaggio_assistenza_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_messaggio_assistenza_richiesta_id" ON "messaggio_assistenza" ("richiesta_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_messaggio_assistenza_deleted_at" ON "messaggio_assistenza" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "messaggio_assistenza" add constraint "messaggio_assistenza_richiesta_id_foreign" foreign key ("richiesta_id") references "richiesta_assistenza" ("id") on update cascade on delete cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "messaggio_assistenza" drop constraint if exists "messaggio_assistenza_richiesta_id_foreign";`);

    this.addSql(`drop table if exists "avviso_letto" cascade;`);

    this.addSql(`drop table if exists "preferenza_avvisi" cascade;`);

    this.addSql(`drop table if exists "richiesta_assistenza" cascade;`);

    this.addSql(`drop table if exists "messaggio_assistenza" cascade;`);
  }

}
