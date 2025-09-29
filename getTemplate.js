const axios = require("axios");

const rpcUser = "pool";
const rpcPassword = "BTCMaster135";
const rpcPort = 8332;
const rpcHost = "192.168.1.113";

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

module.exports = { getBlockTemplate };
