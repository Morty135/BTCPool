require('dotenv').config();
const net = require('net');



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
        console.log("miner: ", message);
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



function handleMessage(message, socket)
{
    switch (message.method) 
    {
        case 'mining.subscribe':
            sendMessage(/*message, socket add responses here*/);
        break;

        case 'mining.authorize':
            sendMessage();
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
    socket.write(message);
    console.log("pool: ", message);
}