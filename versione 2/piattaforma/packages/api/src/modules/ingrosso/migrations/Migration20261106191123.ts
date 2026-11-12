import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106191123 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "trattativa" drop constraint if exists "trattativa_fase_check";`);

    this.addSql(`alter table if exists "trattativa" add column if not exists "unita" integer null;`);
    this.addSql(`update "trattativa" set "fase" = 'richiesta' where "fase" not in ('richiesta', 'campione', 'accordo', 'spedito');`);

    this.addSql(`alter table if exists "trattativa" add constraint "trattativa_fase_check" check("fase" in ('richiesta', 'campione', 'accordo', 'spedito'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "trattativa" drop constraint if exists "trattativa_fase_check";`);

    this.addSql(`alter table if exists "trattativa" drop column if exists "unita";`);

    this.addSql(`alter table if exists "trattativa" add constraint "trattativa_fase_check" check("fase" in ('richiesta', 'trattativa', 'campione', 'accordo', 'perso'));`);
  }

}
