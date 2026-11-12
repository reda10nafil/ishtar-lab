import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106142512 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "ruolo_collaboratore" drop constraint if exists "ruolo_collaboratore_email_unique";`);
    this.addSql(`create table if not exists "ruolo_collaboratore" ("id" text not null, "email" text not null, "ruolo" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "ruolo_collaboratore_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ruolo_collaboratore_email_unique" ON "ruolo_collaboratore" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ruolo_collaboratore_deleted_at" ON "ruolo_collaboratore" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "voce_registro" ("id" text not null, "attore_tipo" text not null, "attore_id" text not null, "azienda_id" text null, "metodo" text not null, "percorso" text not null, "esito" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "voce_registro_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_voce_registro_deleted_at" ON "voce_registro" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "ruolo_collaboratore" cascade;`);

    this.addSql(`drop table if exists "voce_registro" cascade;`);
  }

}
