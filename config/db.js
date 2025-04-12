const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // MySQL kullanıcı adınız
    password: '', // MySQL şifreniz
    database: 'tvdb'
});

module.exports = pool; 