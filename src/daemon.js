const axios = require("axios");
require('dotenv').config();

const rpcUser = process.env.RPC_USER;
const rpcPassword = process.env.RPC_PASSWORD;
const rpcPort = process.env.RPC_PORT;
const rpcHost = process.env.RPC_HOST;

async function getBlockTemplate() {
    const res = await axios.post(
        `http://${rpcHost}:${rpcPort}/`,
        {
            jsonrpc: "1.0",
            id: "nodepool",
            method: "getblocktemplate",
            params: [{ rules: ["segwit"] }],
        },
        {
            auth: { username: rpcUser, password: rpcPassword },
            headers: { "Content-Type": "text/plain" },
        }
    );

    return res.data.result;
}

async function submitBlock(blockHex) {
    const payload = JSON.stringify({
        jsonrpc: "1.0",
        id: "submitblock",
        method: "submitblock",
        params: [blockHex],
    });

    try {
        const res = await axios.post(
            `http://${rpcHost}:${rpcPort}/`,
            payload,
            {
                auth: { username: rpcUser, password: rpcPassword },
                headers: { "Content-Type": "application/json" },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 0
            }
        );

        if (res.data.error) {
            console.error("Node rejected block:", res.data.error);
            return false;
        }

        console.log("Block submitted successfully:", res.data.result);
        return true;

    } catch (err) {
        console.error("RPC submission error:", err.response?.data || err.message);
        return false;
    }
}



async function getBestBlockHash() {
    try {
        const res = await axios.post(
            `http://${rpcHost}:${rpcPort}/`,
            {
                jsonrpc: "1.0",
                id: "pool",
                method: "getbestblockhash",
                params: []
            },
            {
                auth: { username: rpcUser, password: rpcPassword },
                headers: { "Content-Type": "text/plain" },
            }
        );
        return res.data.result;
    } catch (err) {
        console.error("RPC getbestblockhash error:", err.response?.data || err.message);
        return null;
    }
}



module.exports = { getBlockTemplate, submitBlock, getBestBlockHash };
