import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261107013152 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "richiesta_assistenza" add column if not exists "numero" serial;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "richiesta_assistenza" drop column if exists "numero";`);
  }

}
