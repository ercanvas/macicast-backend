const Mux = require('@mux/mux-node');

console.log('Initializing Mux configuration...');

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error('Missing required Mux configuration');
}

try {
    // Initialize Mux client
    const muxClient = new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET,
    });

    console.log('Mux client created successfully');

    // Create Video instance
    const Video = muxClient.Video;
    
    // Test the connection
    Video.Assets.list()
        .then(() => console.log('✅ Mux Video API connection verified'))
        .catch(err => console.error('❌ Mux Video API test failed:', err));

    module.exports = { Video };
} catch (error) {
    console.error('Mux initialization error:', error);
    throw error;
}
