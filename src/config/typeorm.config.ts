import { join } from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config({ override: true }); // Carga .env y prioriza sus valores sobre variables ya exportadas en el entorno

// __dirname aquí es src/config (o dist/config), por eso subimos un nivel
// para que el glob de entidades cubra todo src/ y no solo src/config/.
const rootDir = join(__dirname, '..');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'mi_base_datos',
  entities: [join(rootDir, '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: false, // ¡IMPORTANTE! Manténlo en false si usas migraciones para evitar pérdida de datos
});
