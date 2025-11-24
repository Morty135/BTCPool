require('dotenv').config();
const net = require('net');
const { getJob, submitJob } = require("./job");
const database = require("./database");
const helperFunctions = require("./helperFunctions");
const fs = require("fs");
const { getBestBlockHash } = require("./daemon");
const crypto = require("crypto");
const miner = require('../models/miner');

const sessions = database.sessions;



const server = net.createServer((socket) => 
{
    console.log('Miner connected');

    socket.on('data', (data) => 
    {
        let message = data;
        
        if (helperFunctions.isJSON(data)) 
        {
            message = JSON.parse(data.toString('utf8'));
        }

        logMessage = JSON.stringify(message) + '\n';
        fs.appendFileSync('./pool.log', logMessage);

        handleMessage(message, socket);
    });

    socket.on('end', () => 
    {
        console.log('Miner disconnected');
        sessions.delete(socket.id);
    });

    socket.on('error', (err) => 
    {
        console.error('Socket error:', err.message);
        sessions.delete(socket.id);
    });
});



server.on("connection", (socket) => {
    socket.id = crypto.randomBytes(8).toString("hex");
    console.log("Miner connected:", socket._id);
});



server.listen(process.env.STRATUM_PORT, process.env.STRATUM_HOST, () => 
{
    console.log(`Stratum server listening on ${process.env.STRATUM_HOST}:${process.env.STRATUM_PORT}`);
});



async function handleMessage(message, socket)
{
    let session = sessions.get(socket.id);

    switch (message.method) 
    {
        case 'mining.subscribe': {

            const job = await getJob();
            const extranonce1 = helperFunctions.generateExtranonce1();

            sendMessage({
                id: message.id,
                result: [
                    [["mining.set_difficulty", "subid1"], ["mining.notify", "subid2"]],
                    extranonce1,
                    4
                ],
                error: null
            }, socket);

            session = {
                createdAt: Date.now(),
                socketRef: socket,
                authorized: false,
                username: null,
                difficulty: 0.01,
                job: job,
                extranonce1: extranonce1,
                minerID: null,
                WorkerID: null
            };

            sessions.set(socket.id, session);

            sendMessage({"id": null, "method": "mining.set_difficulty", "params": [session.difficulty]}, socket);
            sendMessage(job, socket);
            break;
        }

        case 'mining.authorize': {

            const response = await database.authorizeMiner(message);
            console.log(response.minerID);

            if (session) {
                session.authorized = response.result;
                session.minerID = response.minerID;
                session.workerID = response.workerID;
                sessions.set(socket.id, session);
            }

            sendMessage(response, socket);
            break;
        }

        case 'mining.submit': {

            if (!session) {
                sendMessage({
                    id: message.id,
                    result: false,
                    error: { code: 31, message: "Session not found" }
                }, socket);
                return;
            }

            const submission = {
                receivedAt: Date.now(),
                params: message.params,
                id: message.id,
                method: message.method,
                difficulty: session.difficulty,
                extranonce1: session.extranonce1,
                minerID: session.minerID,
                workerID: session.workerID
            };

            console.log("miner: " + session.socketRef.id + " submitted a share");

            const valid = await submitJob(submission);

            sendMessage({
                id: message.id,
                result: valid,
                error: valid ? null : { code: 23, message: "Invalid share" }
            }, socket);

            break;
        }

        case 'mining.configure': {
            sendMessage({
                id: message.id,
                result: { "version-rolling": true },
                error: null
            }, socket);
            break;
        }

        default:
            console.log("unknown method: ", message.method);
            sendMessage({
                id: message.id || null,
                result: null,
                error: { code: -32601, message: "Method not found" }
            }, socket);
            return;
    }
}



function sendMessage(message, socket)
{
    message = JSON.stringify(message) + '\n';

    fs.appendFileSync('./pool.log', message);

    socket.write(message);
}



async function updateJobs() {
    let currentHash;
    try {
        currentHash = await getBestBlockHash();
    } catch (err) {
        console.error("Error fetching tip:", err);
        setTimeout(updateJobs, 5000);
        return;
    }

    const reversed = helperFunctions.swapHexEndian(currentHash);

    if (updateJobs.lastHash === reversed) {
        setTimeout(updateJobs, 5000);
        return;
    }

    console.log("New tip detected, updating miners...");
    updateJobs.lastHash = reversed;

    for (const session of sessions.values()) {
        if (!session.authorized) continue;

        const job = await getJob();
        session.job = job;
        sendMessage(job, session.socketRef);
    }

    setTimeout(updateJobs, 5000);
}
updateJobs();