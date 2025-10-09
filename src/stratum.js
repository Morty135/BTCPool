require('dotenv').config();
const net = require('net');
const { getJob, submitJob } = require("./job");
const database = require("./database");
const fs = require("fs")



function isJSON(str) {
    try {
        JSON.parse(str.toString('utf8'));
        return true;
    } catch (e) {
        return false;
    }
}



const server = net.createServer((socket) => 
{
    console.log('Miner connected');

    socket.on('data', (data) => 
    {
        let message = data;
        if (isJSON(data)) 
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
    });

    socket.on('error', (err) => 
    {
        console.error('Socket error:', err.message);
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
            sendMessage({
                id: message.id,
                result: [
                    [["mining.set_difficulty", "subid1"], ["mining.notify", "subid2"]],
                    "session1",
                    4
                ],
                error: null
            }, socket);

            // After subscription, send difficulty and job. its set to 1 for production ready pool I will need to make it dynamic.
            sendMessage({"id": null, "method": "mining.set_difficulty", "params": [1]}, socket);
            sendMessage(await getJob(), socket);
        break;

        case 'mining.authorize':
            response = await database.authorizeMiner(message);
            sendMessage(response, socket);
        break;

        case 'mining.extranonce.subscribe':
        break;

        case 'mining.submit':
        break;

        default:
            console.log("unknown method: ", message.method);
        return;
    }
}



function sendMessage(message, socket)
{
    message = JSON.stringify(message) + '\n';
    fs.appendFileSync('./pool.log', message);
    socket.write(message);
}