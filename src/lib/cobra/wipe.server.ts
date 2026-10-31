import { getSql } from "@/lib/db";

/** Removes one seller's ledger before the auth user row is deleted. */
export async function wipeSellerData(userId: string): Promise<void> {
  const sql = await getSql();
  await sql`delete from cobra_installments where user_id = ${userId}`;
  await sql`delete from cobra_sales where user_id = ${userId}`;
  await sql`delete from cobra_products where user_id = ${userId}`;
  await sql`delete from cobra_customers where user_id = ${userId}`;
  await sql`delete from cobra_ops where user_id = ${userId}`;
}
