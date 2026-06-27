// db/index.js — abre la base de datos SQLite y aplica el esquema.
//
// Usamos "node:sqlite", el módulo de SQLite INTEGRADO en Node (desde v22).
// Ventaja para aprender: no hay que instalar ni compilar nada, y la API es
// SÍNCRONA — las consultas devuelven el resultado directamente, sin callbacks
// ni promesas, así que el código se lee de arriba a abajo.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Aseguramos que exista la carpeta data/ antes de abrir el archivo.
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

// Abre (o crea) el archivo data/app.db.
export const db = new DatabaseSync(config.dbPath);

// Activa las claves foráneas (SQLite las trae apagadas por defecto).
db.exec('PRAGMA foreign_keys = ON;');

// Aplica el esquema. CREATE TABLE IF NOT EXISTS = seguro de repetir.
const schemaPath = path.join(__dirname, 'schema.sql');
const schemaSql = fs.readFileSync(schemaPath, 'utf8');
db.exec(schemaSql);

console.log(`[db] Base de datos lista en ${config.dbPath}`);
