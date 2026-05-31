import db from '../config/database.js';
import { encodeHash } from '../utils/geohash.js';
import { getTimeContext } from '../utils/timeUtils.js';
import { recalculateCell } from './heatmapService.js';

export async function submitRating(data) {
  const { deviceUuid, lat, lng, rating, tags } = data;
  const cellId = encodeHash(lat, lng, 7);

  // 1. Silent discard check: 6-day check
  const recent = await db('ratings')
    .where({ device_uuid: deviceUuid, grid_cell_id: cellId })
    .andWhere('created_at', '>', db.raw("NOW() - INTERVAL '6 days'"))
    .first();

  if (recent) {
    // Silent success - do not write to db, just return cellId
    return { success: true, cellId, discarded: true };
  }

  // 2. Perform DB insert inside transaction
  await db.transaction(async (trx) => {
    // Format coordinates as PostGIS geography point if supported
    let hasPostgis = false;
    try {
      await trx.raw('SELECT postgis_version();');
      hasPostgis = true;
    } catch (_) {}

    const timeCtx = getTimeContext();

    const insertData = {
      device_uuid: deviceUuid,
      lat,
      lng,
      grid_cell_id: cellId,
      safety_rating: rating,
      time_context: timeCtx,
      created_at: trx.fn.now()
    };

    if (hasPostgis) {
      insertData.location = trx.raw(`ST_SetSRID(ST_Point(?, ?), 4326)::geography`, [lng, lat]);
    }

    const [ratingRow] = await trx('ratings').insert(insertData).returning('id');
    const ratingId = typeof ratingRow === 'object' ? ratingRow.id : ratingRow;

    // Process tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        let cleanTag = tagName.trim();
        if (!cleanTag) continue;

        // Check if exists
        let tag = await trx('tags').whereRaw('LOWER(name) = ?', [cleanTag.toLowerCase()]).first();
        if (!tag) {
          const [newTagRow] = await trx('tags').insert({
            name: cleanTag,
            is_predefined: false,
            usage_count: 1
          }).returning('id');
          tag = { id: typeof newTagRow === 'object' ? newTagRow.id : newTagRow };
        } else {
          await trx('tags').where({ id: tag.id }).increment('usage_count', 1);
        }

        await trx('rating_tags').insert({
          rating_id: ratingId,
          tag_id: tag.id
        });
      }
    }
  });

  // 3. Update the cell score asynchronously
  // (We don't await this if we want fast response, but awaiting is fine here for safety)
  await recalculateCell(cellId);

  return { success: true, cellId, discarded: false };
}
