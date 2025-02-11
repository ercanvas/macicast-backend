const Mux = require('@mux/mux-node');

// Debug logging
console.log('Initializing Mux configuration...');
console.log('MUX_TOKEN_ID exists:', !!process.env.MUX_TOKEN_ID);
console.log('MUX_TOKEN_SECRET exists:', !!process.env.MUX_TOKEN_SECRET);

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error('Missing required Mux configuration');
}

let mux;
try {
    mux = new Mux({
        tokenId: process.env.MUX_TOKEN_ID,
        tokenSecret: process.env.MUX_TOKEN_SECRET
    });
    
    console.log('Mux client created successfully');
    console.log('Mux Video API available:', !!mux.Video);
    console.log('Mux Assets API available:', !!(mux.Video && mux.Video.Assets));
    
    // Basic API test
    const { Video } = mux;
    if (!Video || !Video.Assets) {
        throw new Error('Mux Video or Assets API not available');
    }
    
    module.exports = { Video };
} catch (error) {
    console.error('Mux initialization error:', error);
    throw new Error(`Failed to initialize Mux client: ${error.message}`);
}
