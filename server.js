const axios = "axios";

const rpcUser = "pool";
const rpcPassword = "YOURPASSWORD";
const rpcPort = 8332;
const rpcHost = "127.0.0.1";

export async function getBlockTemplate() 
{
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