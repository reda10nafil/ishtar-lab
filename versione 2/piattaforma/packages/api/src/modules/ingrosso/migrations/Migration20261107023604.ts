import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261107023604 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "trattativa" add column if not exists "spostata_il" timestamptz null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "trattativa" drop column if exists "spostata_il";`);
  }

}
