const Mux = require('@mux/mux-node');

if (!process.env.MUX_TOKEN_ID || !process.env.MUX_TOKEN_SECRET) {
    throw new Error('Missing required Mux configuration');
}

const mux = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET
});

if (!mux.Video || !mux.Video.Assets) {
    throw new Error('Mux Video client not properly initialized');
}

const { Video } = mux;

module.exports = { Video };
