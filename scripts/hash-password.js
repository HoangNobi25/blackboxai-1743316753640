const bcrypt = require('bcrypt');

async function hashPassword() {
    const password = 'Hoang123'; // Default password for testing
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('Hashed password:', hashedPassword);
}

hashPassword();