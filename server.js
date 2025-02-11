const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const knex = require('knex');

// Load environment variables
dotenv.config();

// Database configuration
const db = knex({
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    }
});

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes

// Get all channels
app.get('/api/channels', async (req, res) => {
    try {
        const channels = await db('channels')
            .where('is_active', true)
            .orderBy('channel_number', 'asc');
        res.json(channels);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Failed to fetch channels' });
    }
});

// Search channels
app.get('/api/channels/search', async (req, res) => {
    const { q } = req.query;
    try {
        const channels = await db('channels')
            .where('is_active', true)
            .andWhere(function() {
                this.where('name', 'like', `%${q}%`)
                    .orWhere('channel_number', 'like', `%${q}%`)
                    .orWhere('category', 'like', `%${q}%`);
            })
            .orderBy('channel_number', 'asc');
        res.json(channels);
    } catch (error) {
        console.error('Error searching channels:', error);
        res.status(500).json({ error: 'Failed to search channels' });
    }
});

// Add a new channel
app.post('/api/channels', async (req, res) => {
    const { name, channel_number, stream_url, logo_url, category } = req.body;
    try {
        const [id] = await db('channels').insert({
            name,
            channel_number,
            stream_url,
            logo_url,
            category,
            is_active: true,
            is_hls: true,
            created_at: new Date()
        });
        
        const channel = await db('channels').where({ id }).first();
        res.json({ message: 'Channel added successfully', channel });
    } catch (error) {
        console.error('Error adding channel:', error);
        res.status(500).json({ error: 'Failed to add channel' });
    }
});

// Update a channel
app.put('/api/channels/:id', async (req, res) => {
    const { id } = req.params;
    const { name, channel_number, stream_url, logo_url, category, is_active } = req.body;
    try {
        await db('channels')
            .where({ id })
            .update({
                name,
                channel_number,
                stream_url,
                logo_url,
                category,
                is_active,
                updated_at: new Date()
            });
        
        const channel = await db('channels').where({ id }).first();
        res.json({ message: 'Channel updated successfully', channel });
    } catch (error) {
        console.error('Error updating channel:', error);
        res.status(500).json({ error: 'Failed to update channel' });
    }
});

// Delete a channel
app.delete('/api/channels/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db('channels').where({ id }).delete();
        res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ error: 'Failed to delete channel' });
    }
});

// Get favorite channels
app.get('/api/favorites', async (req, res) => {
    try {
        const favorites = await db('favorites')
            .join('channels', 'favorites.channel_id', 'channels.id')
            .where('channels.is_active', true)
            .select('channels.*');
        res.json(favorites);
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Failed to fetch favorite channels' });
    }
});

// Add to favorites
app.post('/api/favorites/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        await db('favorites').insert({
            channel_id: channelId,
            created_at: new Date()
        });
        res.json({ message: 'Added to favorites' });
    } catch (error) {
        console.error('Error adding to favorites:', error);
        res.status(500).json({ error: 'Failed to add to favorites' });
    }
});

// Remove from favorites
app.delete('/api/favorites/:channelId', async (req, res) => {
    const { channelId } = req.params;
    try {
        await db('favorites').where({ channel_id: channelId }).delete();
        res.json({ message: 'Removed from favorites' });
    } catch (error) {
        console.error('Error removing from favorites:', error);
        res.status(500).json({ error: 'Failed to remove from favorites' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : {}
    });
});

// Server setup
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});