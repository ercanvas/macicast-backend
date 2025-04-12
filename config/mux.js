const { Mux } = require('@mux/mux-node');

console.log('Initializing Mux configuration...');
console.log('Environment:', process.env.NODE_ENV || 'development');

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error('Missing required Mux configuration');
}

try {
    // Initialize Mux client with production credentials
    const { video } = new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET
    });

    console.log('Mux client created successfully');
    console.log('Using Token ID:', process.env.MUX_TOKEN_ID);

    // Verify the connection with production credentials
    video.assets.list({ limit: 1 })
        .then(() => {
            console.log('✅ Mux Video API connection verified (Production)');
        })
        .catch(err => {
            console.error('❌ Mux Video API test failed:', err);
        });

    module.exports = { Video: video };
} catch (error) {
    console.error('Mux initialization error:', error);
    throw error;
}
