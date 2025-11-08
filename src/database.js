const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(`mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/stratumPool`, {})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));

const Miner = require('../models/miner');
const Worker = require('../models/worker');

// local in-memory session store — keep runtime/session data here, not in DB
const sessions = new Map();

async function authorizeMiner(message)
{
    const [username, password] = message.params

    let response = {
        id: message.id,
        result: false,
        error: 'Unauthorized'
    }

    usernameSplit = username.split('.');
    const workerName = usernameSplit[1];
    const minerName = usernameSplit[0];

    try 
    {
        const miner = await Miner.findOne({ username: minerName });
        if (!miner) 
        {
            response.error = 'Miner not found';
            return response;
        }

        const isMatch = await miner.comparePassword(password);
        if (!isMatch) {
            response.error = 'Invalid password';
            return response;
        }

        const worker = await Worker.findOne({ name: workerName });
        if (!worker) 
        {
            Worker.create({ name: workerName, miner: miner._id });
        }
        else
        {
            worker.lastSeen = Date.now();
            await worker.save();
        }

        response.id = message.id;
        response.result = true;
        response.error = null;

    }
    catch (error) 
    {
        response.error = error.message || error;
    }

    return response;
}

module.exports = { authorizeMiner, sessions };