const { getBlockTemplate } = require("./getTemplate");
const { buildCoinbase } = require("./coinbase");

function swapHexEndian(hex) {
    return hex.match(/../g).reverse().join("");
}

function buildJob(template, payoutAddress) 
{
    const jobId = Date.now().toString();

    const prevHashLE = swapHexEndian(template.previousblockhash);

    const coinbaseTx = buildCoinbase(template, payoutAddress);

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

async function main() {
    const template = await getBlockTemplate();
    const payout = "1YourLegacyAddressHere"; // replace with your own
    const job = buildJob(template, payout);
    console.log("Job for miner:\n", JSON.stringify(job, null, 2));
}

main();
