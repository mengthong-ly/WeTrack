// Applies drizzle/ migrations on the server, where drizzle-kit isn't installed.
// Bundled to migrate.cjs by deploy-staging.yml and run by deploy/staging-release.sh.
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

const db = drizzle(process.env.DATABASE_URL!)
migrate(db, { migrationsFolder: "drizzle" }).finally(() => db.$client.end())
