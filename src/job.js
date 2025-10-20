require('dotenv').config();
const { getBlockTemplate, submitBlock } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const fs = require("fs");

function swapHexEndian(hex) {
    return hex.match(/../g).reverse().join("");
}

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

    // Rebuild coinbase
    const coinbaseHex = job.params[2] + extraNonce2 + job.params[3];
    const coinbaseTx = Buffer.from(coinbaseHex, "hex");

    // Compute merkle root
    let tree = [bitcoin.crypto.hash256(coinbaseTx)];
    const txHashes = job.params[4].map(h => Buffer.from(h, "hex"));
    tree = tree.concat(txHashes);

    while (tree.length > 1) {
        const next = [];
        for (let i = 0; i < tree.length; i += 2) {
            const left = tree[i];
            const right = tree[i+1] || tree[i];
            next.push(bitcoin.crypto.hash256(Buffer.concat([left, right])));
        }
        tree = next;
    }
    const merkleRoot = tree[0].toString("hex");

    // Build block header
    const header = Buffer.concat([
        Buffer.from(job.params[5], "hex"),   // version
        Buffer.from(job.params[1], "hex"),   // prevBlock
        Buffer.from(merkleRoot, "hex"),      // merkleRoot
        Buffer.from(nTime, "hex"),           // nTime
        Buffer.from(job.params[6], "hex"),   // bits
        Buffer.from(nonce, "hex")            // nonce
    ]);

    // Build full block (header + coinbase)
    const blockHex = Buffer.concat([header, coinbaseTx]).toString("hex");

    // Submit to node
    const success = await submitBlock(blockHex);
    return success ? blockHex : null;
}



module.exports = { getJob, submitJob };
