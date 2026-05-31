import express from 'express';
import { submitRating } from '../services/ratingService.js';
import db from '../config/database.js';

const router = express.Router();

router.post('/ratings', async (req, res) => {
  const { device_uuid, latitude, longitude, safety_rating, tags, local_hour } = req.body;

  if (!device_uuid || latitude === undefined || longitude === undefined || !safety_rating) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const rat = parseInt(safety_rating, 10);
  if (isNaN(rat) || rat < 1 || rat > 5) {
    return res.status(400).json({ error: 'Safety rating must be between 1 and 5' });
  }

  try {
    const output = await submitRating({
      deviceUuid: device_uuid,
      lat: parseFloat(latitude),
      lng: parseFloat(longitude),
      rating: rat,
      tags: Array.isArray(tags) ? tags : [],
      localHour: local_hour !== undefined ? parseInt(local_hour, 10) : undefined
    });

    res.status(201).json(output);
  } catch (err) {
    console.error('Error submitting rating:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/tags', async (req, res) => {
  try {
    // Get predefined tags
    const predefined = await db('tags')
      .where({ is_predefined: true })
      .select('id', 'name');

    // Get popular user custom tags
    const custom = await db('tags')
      .where({ is_predefined: false })
      .orderBy('usage_count', 'desc')
      .limit(10)
      .select('id', 'name', 'usage_count');

    res.json({
      predefined,
      popular_custom: custom
    });
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
