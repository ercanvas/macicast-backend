const Mux = require('@mux/mux-node');

const { Video } = new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET
});

module.exports = { Video };
