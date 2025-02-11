require('dotenv').config();
const mongoose = require('mongoose');

// MONGO_URL bağlantı adresini al
const mongoURI = process.env.MONGO_URL;

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB bağlantısı başarılı!"))
.catch(err => console.error("❌ MongoDB bağlantı hatası:", err));
