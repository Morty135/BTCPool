const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

mongoose.connect(`mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/stratumPool`, {})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('MongoDB error:', err));

const Miner = require('../models/miner');
const Session = require("../models/session");

async function authorizeMiner(message)
{
    const [username, password] = message.params

    let response = {
        id: message.id,
        result: false,
        error: 'Unauthorized'
    }

    try 
    {
        const miner = await Miner.findOne({ username });
        if (!miner) 
        {
            response.error = 'Miner not found';
            return response;
        }

        //use bcryptjs for this later
        //const isMatch = await bcrypt.compare(password, miner.password);
        if (password != miner.password) {
            response.error = 'Invalid password';
            return response;
        }

        response.id = message.id;
        response.result = true;
        response.error = null;
    }
    catch (error) 
    {
        response.error = error;
    }

    return response;
}



async function createSession(socket)
{
    const sessionId = uuidv4();

    const session = new Session({
        sessionId: sessionId,
        ip: socket.remoteAddress
    });
    await session.save();

    return sessionId
}



async function updateSession(sessionId)
{
    const session = await Session.findOne({ sessionId });
    if (!session) 
    {
        response.error = 'Session not found';
        return error;
    }
    await session.save();
}



async function closeSession(sessionId)
{
    const session = await Session.findOne({ sessionId });
    if (!session) 
    {
        response.error = 'Session not found';
        return error;
    }
    session.status = "closed";
    await session.save();
}

module.exports = { authorizeMiner, createSession, updateSession, closeSession};