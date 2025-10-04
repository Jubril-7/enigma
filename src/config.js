require('dotenv').config();

const config = {
    ownerNumber: process.env.OWNER_NUMBER || '',
    controlGroupId: process.env.CONTROL_GROUP || '',
    prefix: process.env.PREFIX,
};

module.exports = { config };