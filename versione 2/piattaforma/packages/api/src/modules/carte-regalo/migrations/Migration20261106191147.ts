import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261106191147 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "carta_regalo" add column if not exists "congelata" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "carta_regalo" drop column if exists "congelata";`);
  }

}
