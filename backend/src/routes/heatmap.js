import express from 'express';
import db from '../config/database.js';

const router = express.Router();

router.get('/heatmap', async (req, res) => {
  const { swLat, swLng, neLat, neLng, timeFilter } = req.query;

  try {
    let query = db('grid_cells');

    // Filter by box if bounds are sent
    if (swLat && swLng && neLat && neLng) {
      query = query
        .where('center_lat', '>=', parseFloat(swLat))
        .where('center_lat', '<=', parseFloat(neLat))
        .where('center_lng', '>=', parseFloat(swLng))
        .where('center_lng', '<=', parseFloat(neLng));
    }

    const cells = await query.select('*');

    const formatted = cells.map(c => {
      // Pick score based on filter
      let score = c.weighted_score;
      if (timeFilter === 'day') {
        score = c.day_score || c.weighted_score;
      } else if (timeFilter === 'night') {
        score = c.night_score || c.weighted_score;
      }

      return {
        cell_id: c.cell_id,
        center: {
          lat: c.center_lat,
          lng: c.center_lng
        },
        score: parseFloat(score.toFixed(2)),
        total_ratings: c.total_ratings
      };
    });

    res.json({ cells: formatted });
  } catch (err) {
    console.error('Error fetching heatmap:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
