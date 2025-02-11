const Mux = require('@mux/mux-node');
const { Video } = new Mux(
  process.env.MUX_TOKEN_ID,
  process.env.MUX_TOKEN_SECRET
);

module.exports = { Video };
