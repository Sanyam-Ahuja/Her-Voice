export const up = async (knex) => {
  // Enable PostGIS extension if available
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis;');

  // Enable uuid-ossp for UUID generation
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // tags table
  await knex.schema.createTable('tags', (table) => {
    table.increments('id').primary();
    table.string('name', 100).notNullable().unique();
    table.boolean('is_predefined').defaultTo(true);
    table.integer('usage_count').defaultTo(0);
  });

  // ratings table
  await knex.schema.createTable('ratings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('device_uuid', 64).notNullable();
    table.double('lat').notNullable();
    table.double('lng').notNullable();
    table.string('grid_cell_id', 20).notNullable();
    table.integer('safety_rating').notNullable(); // 1-5
    table.string('time_context', 10).notNullable(); // day, night, dawn, dusk
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Spatial indexing via raw SQL
    table.index(['grid_cell_id']);
    table.index(['device_uuid']);
  });

  // rating_tags table
  await knex.schema.createTable('rating_tags', (table) => {
    table.uuid('rating_id').references('id').inTable('ratings').onDelete('CASCADE');
    table.integer('tag_id').references('id').inTable('tags').onDelete('CASCADE');
    table.primary(['rating_id', 'tag_id']);
  });

  // grid_cells table (cache table for aggregated heatmap data)
  await knex.schema.createTable('grid_cells', (table) => {
    table.string('cell_id', 20).primary();
    table.double('center_lat').notNullable();
    table.double('center_lng').notNullable();
    table.double('weighted_score').defaultTo(0.0);
    table.integer('total_ratings').defaultTo(0);
    table.double('day_score').defaultTo(0.0);
    table.double('night_score').defaultTo(0.0);
    table.timestamp('last_updated').defaultTo(knex.fn.now());
  });

  // Create geography column on ratings using raw sql if PostGIS exists
  try {
    await knex.raw('SELECT postgis_version();');
    await knex.raw('ALTER TABLE ratings ADD COLUMN location geography(Point, 4326);');
    await knex.raw('CREATE INDEX ratings_location_gix ON ratings USING GIST (location);');
  } catch (err) {
    console.log('PostGIS not available or failed to configure. Falling back to lat/lng index.');
    await knex.schema.alterTable('ratings', (table) => {
      table.index(['lat', 'lng']);
    });
  }
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('rating_tags');
  await knex.schema.dropTableIfExists('ratings');
  await knex.schema.dropTableIfExists('tags');
  await knex.schema.dropTableIfExists('grid_cells');
};
