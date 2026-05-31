import db from '../config/database.js';
import { decodeHash } from '../utils/geohash.js';

const LAMBDA = 0.00770163533; // ln(2) / 90-day half-life

export async function recalculateCell(cellId) {
  const sql = `
    SELECT 
      COUNT(*) as total,
      COALESCE(
        SUM(safety_rating * EXP(-${LAMBDA} * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))) /
        NULLIF(SUM(EXP(-${LAMBDA} * (EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0))), 0),
        0
      ) as weighted_score
    FROM ratings
    WHERE grid_cell_id = ?
  `;

  // pg driver returns { rows, command, ... } — NOT an array
  const result = await db.raw(sql, [cellId]);
  const stats = result.rows[0];

  const total = parseInt(stats.total, 10);
  if (total === 0) {
    await db('grid_cells').where({ cell_id: cellId }).del();
    return;
  }

  const coords = decodeHash(cellId);
  const payload = {
    weighted_score: parseFloat(stats.weighted_score) || 0,
    total_ratings: total,
    day_score: 0,
    night_score: 0,
    last_updated: db.fn.now()
  };

  const exists = await db('grid_cells').where({ cell_id: cellId }).first();
  if (exists) {
    await db('grid_cells').where({ cell_id: cellId }).update(payload);
  } else {
    await db('grid_cells').insert({
      cell_id: cellId,
      center_lat: coords.lat,
      center_lng: coords.lng,
      ...payload
    });
  }
}

export async function recalculateAll() {
  const cells = await db('ratings').distinct('grid_cell_id');
  for (const cell of cells) {
    await recalculateCell(cell.grid_cell_id);
  }
}
