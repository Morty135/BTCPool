const axios = require("axios");

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
    try {
        const res = await axios.post(
            `http://${rpcHost}:${rpcPort}/`,
            {
                jsonrpc: "1.0",
                id: "submitblock",
                method: "submitblock",
                params: [blockHex],
            },
            {
                auth: { username: rpcUser, password: rpcPassword },
                headers: { "Content-Type": "text/plain" },
            }
        );

        if (res.data.error) {
            console.error("Node rejected block:", res.data.error);
            return false;
        } else {
            console.log("Block submitted successfully:", res.data.result);
            return true;
        }
    } catch (err) {
        console.error("RPC submission error:", err.message);
        return false;
    }
}

module.exports = { getBlockTemplate, submitBlock };
