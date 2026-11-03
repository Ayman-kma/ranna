// Clears all orders and push subscriptions (keeps merchant + staff accounts).
// Run from the server dir: `npm --prefix server run reset`
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const file = path.resolve(process.cwd(), process.env.DB_FILE || "./data/ranna.sqlite");
const db = new DatabaseSync(file);
db.exec("DELETE FROM orders; DELETE FROM push_subscriptions;");
db.close();
console.log("[ranna] cleared orders + push subscriptions");
