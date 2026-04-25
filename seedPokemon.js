require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pokemongo',
  });

  console.log('Conectado a MySQL');

  const listRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=150');
  const listData = await listRes.json();

  for (const item of listData.results) {
    const detailRes = await fetch(item.url);
    const detail = await detailRes.json();

    const id = Number(detail.id);
    const nombre = String(detail.name);
    const tipo = detail.types?.[0]?.type?.name || 'normal';
    const poder = detail.moves?.[0]?.move?.name || 'tackle';

    await conn.execute(
      `
      INSERT INTO pokemon (id, nombre, tipo, poder, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        tipo = VALUES(tipo),
        poder = VALUES(poder),
        updatedAt = NOW()
      `,
      [id, nombre, tipo, poder]
    );

    console.log(`Insertado/actualizado: #${id} ${nombre}`);
  }

  await conn.end();
  console.log('Listo: 150 Pokémon cargados');
}

main().catch((err) => {
  console.error('Error cargando Pokémon:', err);
  process.exit(1);
});