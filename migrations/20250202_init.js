exports.up = function(knex) {
    return knex.schema
        .createTable('channels', function(table) {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.integer('channel_number').notNullable().unique();
            table.string('stream_url').notNullable();
            table.string('logo_url');
            table.string('category').defaultTo('general');
            table.boolean('is_active').defaultTo(true);
            table.boolean('is_hls').defaultTo(true);
            table.timestamp('created_at').defaultTo(knex.fn.now());
            table.timestamp('updated_at').defaultTo(knex.fn.now());
        })
        .createTable('favorites', function(table) {
            table.increments('id').primary();
            table.integer('channel_id').unsigned().references('id').inTable('channels').onDelete('CASCADE');
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
};

exports.down = function(knex) {
    return knex.schema
        .dropTable('favorites')
        .dropTable('channels');
};
