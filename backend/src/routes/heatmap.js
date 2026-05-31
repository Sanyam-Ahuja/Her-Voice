import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/heatmap', async (req, res) => {
  const { swLat, swLng, neLat, neLng, hour } = req.query;

  try {
    // Resolve queried hour (0 to 23). If 'live' or missing, default to current local server hour.
    let targetHour;
    if (hour === 'live' || !hour) {
      targetHour = new Date().getHours();
    } else {
      targetHour = parseInt(hour, 10);
    }

    // Postgres SQL expression to resolve rating hour: checks for integer strings, defaults legacy seeds
    const hrExpr = `(CASE WHEN r.time_context ~ '^[0-9]+$' THEN CAST(r.time_context AS INTEGER) WHEN r.time_context = 'day' THEN 12 ELSE 0 END)`;

    // Dynamic aggregation query on ratings with circular temporal Gaussian decay
    const query = db('ratings as r')
      .join('grid_cells as c', 'r.grid_cell_id', 'c.cell_id')
      .select(
        'r.grid_cell_id',
        'c.center_lat',
        'c.center_lng'
      )
      .count('r.id as total_ratings')
      .select(
        db.raw(`
          COALESCE(
            SUM(
              r.safety_rating * 
              EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
              EXP(-POWER(LEAST(ABS(${hrExpr} - ?), 24 - ABS(${hrExpr} - ?)), 2) / 4.5)
            ) / 
            NULLIF(
              SUM(
                EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
                EXP(-POWER(LEAST(ABS(${hrExpr} - ?), 24 - ABS(${hrExpr} - ?)), 2) / 4.5)
              ), 
              0
            ),
            0
          ) as score
        `, [targetHour, targetHour, targetHour, targetHour]),
        db.raw(`
          SUM(
            EXP(-0.0077 * (EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 86400.0)) * 
            EXP(-POWER(LEAST(ABS(${hrExpr} - ?), 24 - ABS(${hrExpr} - ?)), 2) / 4.5)
          ) as total_weight
        `, [targetHour, targetHour])
      );

    // Apply bounding box constraints if provided to limit scanning
    if (swLat && swLng && neLat && neLng) {
      query
        .where('c.center_lat', '>=', parseFloat(swLat))
        .where('c.center_lat', '<=', parseFloat(neLat))
        .where('c.center_lng', '>=', parseFloat(swLng))
        .where('c.center_lng', '<=', parseFloat(neLng));
    }

    query.groupBy('r.grid_cell_id', 'c.center_lat', 'c.center_lng');

    const cells = await query;

    const formatted = cells
      .map(c => {
        const totalWeight = parseFloat(c.total_weight) || 0;
        // Require at least one active rating weight of 0.05 (approx. within 3.5 hours and active decay)
        if (totalWeight < 0.05) return null;

        const score = parseFloat(c.score);
        return {
          cell_id: c.grid_cell_id,
          center: {
            lat: parseFloat(c.center_lat),
            lng: parseFloat(c.center_lng)
          },
          score: parseFloat(score.toFixed(2)),
          total_ratings: parseInt(c.total_ratings, 10)
        };
      })
      .filter(Boolean);

    res.json({ cells: formatted });
  } catch (err) {
    console.error('Error fetching heatmap:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
