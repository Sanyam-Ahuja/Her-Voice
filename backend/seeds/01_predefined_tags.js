export const seed = async (knex) => {
  // Deletes ALL existing entries
  await knex('rating_tags').del();
  await knex('tags').del();

  // Inserts seed entries
  await knex('tags').insert([
    { name: 'Poor Lighting', is_predefined: true },
    { name: 'Lonely Area', is_predefined: true },
    { name: 'Harassment History', is_predefined: true },
    { name: 'Good Police Presence', is_predefined: true },
    { name: 'Well Crowded', is_predefined: true },
    { name: 'Safe at Night', is_predefined: true },
    { name: 'Unsafe Transport Stop', is_predefined: true },
    { name: 'Construction/Isolated', is_predefined: true }
  ]);
};
