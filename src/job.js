require('dotenv').config();
const { getBlockTemplate, submitBlock } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const { encodeVarInt, swapHexEndian } = require("./helperFunctions");
const bitcoin = require("bitcoinjs-lib");



function buildStratumJob(template, payoutAddress) {
    const jobId = Date.now().toString();
    const prevHashLE = swapHexEndian(template.previousblockhash);

    // Build full coinbase transaction
    const coinbaseTx = buildCoinbaseTx(template, payoutAddress);

    // Temporary coinbase split (miners insert extranonce between coinb1 and coinb2)
    const coinb1 = coinbaseTx.slice(0, 100);
    const coinb2 = coinbaseTx.slice(100);

    const merkleBranches = template.transactions.map(tx => tx.txid);

    // Convert and pad fields
    const version = swapHexEndian(template.version.toString(16).padStart(8, "0"));
    const bits = template.bits.padStart(8, "0");
    const ntime = template.curtime.toString(16).padStart(8, "0");

    // Return the Stratum mining.notify job
    return {
        id: null,
        method: "mining.notify",
        params: [
            jobId,
            prevHashLE,
            coinb1,
            coinb2,
            merkleBranches,
            version,
            bits,
            ntime,
            true
        ]
    };
}

async function getJob() {
    const template = await getBlockTemplate();
    return buildStratumJob(template, process.env.POOL_ADDRESS);
}



async function submitJob(submission, job) {
    const [workerName, jobId, extraNonce2, nTime, nonce] = submission.params;

    console.log(submission, job );

    //Rebuild coinbase transaction
    const coinbaseHex = job.params[2] + extraNonce2 + job.params[3];
    const coinbaseTx = Buffer.from(coinbaseHex, "hex");

    //Compute merkle root properly
    let merkle = bitcoin.crypto.hash256(coinbaseTx);
    for (const branch of job.params[4]) {
        const branchBuf = Buffer.from(branch, "hex").reverse(); // convert to LE
        merkle = bitcoin.crypto.hash256(Buffer.concat([merkle, branchBuf]));
    }
    const merkleRootLE = merkle.reverse(); // final root LE for header

    //Build block header
    const version = Buffer.from(job.params[5], "hex"); // version (BE)
    const prevHashLE = Buffer.from(job.params[1], "hex").reverse();
    const nTimeLE = Buffer.from(nTime, "hex").reverse();
    const bits = Buffer.from(job.params[6], "hex");
    const nonceLE = Buffer.from(nonce, "hex").reverse();

    const header = Buffer.concat([
        version,
        prevHashLE,
        merkleRootLE,
        nTimeLE,
        bits,
        nonceLE
    ]);

    //Add transactions
    const txCount = job.params[4].length + 1; // coinbase + others
    const varintCount = encodeVarInt(txCount);
    const txs = [coinbaseTx, ...job.params[4].map(tx => Buffer.from(tx, "hex"))];

    const block = Buffer.concat([header, varintCount, ...txs]);
    console.log(block);
    const blockHex = block.toString("hex");
    submitBlock(blockHex);
}



module.exports = { getJob, submitJob };
