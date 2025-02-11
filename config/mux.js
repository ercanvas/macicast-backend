const Mux = require('@mux/mux-node');

console.log('Initializing Mux configuration...');
console.log('Environment:', process.env.NODE_ENV || 'development');

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error('Missing required Mux configuration');
}

try {
    // Initialize Mux client with production credentials
    const muxClient = new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET,
        defaultEnvironmentId: 'production' // Explicitly set to production
    });

    console.log('Mux client created successfully');
    console.log('Using Token ID:', process.env.MUX_TOKEN_ID);

    const Video = muxClient.Video;
    
    // Verify the connection with production credentials
    Video.Assets.list({ limit: 1 })
        .then(() => {
            console.log('✅ Mux Video API connection verified (Production)');
        })
        .catch(err => {
            console.error('❌ Mux Video API test failed:', err);
        });

    module.exports = { Video };
} catch (error) {
    console.error('Mux initialization error:', error);
    throw error;
}
