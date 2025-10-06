require('dotenv').config();
const { getBlockTemplate } = require("./getTemplate");
const { buildCoinbaseTx } = require("./coinbase");

function swapHexEndian(hex) {
    return hex.match(/../g).reverse().join("");
}

function buildJob(template, payoutAddress) 
{
    const jobId = Date.now().toString();

    const prevHashLE = swapHexEndian(template.previousblockhash);

    const coinbaseTx = buildCoinbaseTx(template, payoutAddress);

    const merkleBranches = template.transactions.map((tx) => tx.txid);

    return {
        id: jobId,
        prevHash: prevHashLE,
        coinbase: coinbaseTx,
        merkleBranches,
        version: template.version.toString(16),
        bits: template.bits,
        ntime: template.curtime.toString(16),
        cleanJobs: true,
    };
}

async function getJob() {
    const template = await getBlockTemplate();
    const job = buildJob(template, process.env.POOL_ADDRESS);
    return job;
}

module.exports = { getJob };
