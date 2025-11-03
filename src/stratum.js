require('dotenv').config();
const net = require('net');
const { getJob, submitJob } = require("./job");
const database = require("./database");
const helperFunctions = require("./helperFunctions");
const fs = require("fs");
const { getBestBlockHash } = require("./daemon");

const sessions = database.sessions;
const socketSessions = new WeakMap();



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
        const sid = socketSessions.get(socket);
        if (sid) {
            sessions.delete(sid);
            socketSessions.delete(socket);
        }
    });

    socket.on('error', (err) => 
    {
        console.error('Socket error:', err.message);
        const sid = socketSessions.get(socket);
        if (sid) {
            sessions.delete(sid);
            socketSessions.delete(socket);
        }
    });
});



server.listen(process.env.STRATUM_PORT, process.env.STRATUM_HOST, () => 
{
    console.log(`Stratum server listening on ${process.env.STRATUM_HOST}:${process.env.STRATUM_PORT}`);
});



async function handleMessage(message, socket)
{
    switch (message.method) 
    {
        case 'mining.subscribe':
            // generate a per-connection session id and return it in the response
            const sessionId = helperFunctions.generateSessionId();
            sendMessage({
                id: message.id,
                result: [
                    [["mining.set_difficulty", "subid1"], ["mining.notify", "subid2"]],
                    sessionId, // session ID is a valid 4 byte hex so it is also used as extranonce1
                    4
                ],
                error: null
            }, socket);

            // create session entry for later reconstruction
            const session = {
                id: sessionId,
                createdAt: Date.now(),
                socketRef: socket,
                authorized: false,
                username: null,
                lastJob: null,
                submissions: []
            };
            sessions.set(sessionId, session);
            socketSessions.set(socket, sessionId);

            sendMessage({"id": null, "method": "mining.set_difficulty", "params": [1]}, socket);

            const job = await getJob();
            session.lastJob = job;
            sendMessage(job, socket);
        break;

        case 'mining.authorize':
            response = await database.authorizeMiner(message);

            if (response && response.result === true) {
                const sid = socketSessions.get(socket);
                if (sid) {
                    const s = sessions.get(sid);
                    if (s) {
                        s.authorized = true;
                        s.username = message.params[0];
                        s.authorizedAt = Date.now();
                    }
                }
            }
            sendMessage(response, socket);
        break;

        case 'mining.extranonce.subscribe':
        break;

        case 'mining.submit':
            // store submission in the in-memory session for later block reconstruction
            const sid = socketSessions.get(socket);
            if (!sid) {
                console.warn('Received submit without session for socket');
                console.log(message);
                break;
            }
            const s = sessions.get(sid);
            if (!s) {
                console.warn('Session not found for submit:', sid);
                console.log(message);
                break;
            }

            const submission = {
                receivedAt: Date.now(),
                params: message.params,
                id: message.id,
                method: message.method
            };
            s.submissions.push(submission);

            console.log("miner: " + sid + " submitted a share");

            const valid = await submitJob(submission, s.lastJob);

            const submitResponse = {
                id: message.id,
                result: valid,
                error: valid ? null : { code: 23, message: "Invalid share" }
            };
            sendMessage(submitResponse, socket);
        break;

        case 'mining.configure':
            sendMessage({
                id: message.id,
                result: { "version-rolling": false },
                error: null
            }, socket);
        break;

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



async function updateJobs()
{
    var currentHeight;
    try {
        currentHeight = await getBestBlockHash();
    }
    catch (error) 
    {
        console.error("Error fetching best block hash:", error);
        return;
    }
    currentHeight = helperFunctions.swapHexEndian(currentHeight);

    // keep a static copy of last height to skip pointless loops
    if (updateJobs.lastHeight === currentHeight) {
        console.log("No new blocks, skipping update.");
    } else {
        console.log("New tip detected, updating all miners...");
        updateJobs.lastHeight = currentHeight;

        for (const [sid, session] of sessions) {
            const socket = session.socketRef;
            if (!socket || socket.destroyed) continue;

            const job = await getJob();

            session.lastJob = job;
            sendMessage(job, socket);
        }
    }
    
    setTimeout(updateJobs, 5000);
}
updateJobs();