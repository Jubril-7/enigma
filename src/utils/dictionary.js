const axios = require('axios');

async function validateWord(word) {
    try {
        const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        return response.status === 200;
    } catch {
        return false;
    }
}

module.exports = { validateWord };