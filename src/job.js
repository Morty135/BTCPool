require('dotenv').config();
const { getBlockTemplate, submitBlock, getBestBlockHash } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const { encodeVarInt, swapHexEndian } = require("./helperFunctions");
const bitcoin = require("bitcoinjs-lib");

const jobCache = new Map(); // jobId -> full data for block submission



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

    // caches the full tx data for later use during submission
    jobCache.set(jobId, {
        prevHash: template.previousblockhash,
        version: version,
        bits: bits,
        coinb1,
        coinb2,
        txids: template.transactions.map(tx => tx.txid),
        fullTxData: template.transactions.map(tx => tx.data)
    });
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



async function submitJob(submission) {
    const [workerName, jobId, extraNonce2, nTime, nonce] = submission.params;

    // Load the original template data you cached when creating the job
    const job = jobCache.get(jobId);
    if (!job) {
        console.error("Unknown jobId:", jobId);
        return;
    }

    const { prevHash, version, bits, coinb1, coinb2, txids, fullTxData } = job;

    // 1. Rebuild the coinbase transaction
    const coinbaseHex = coinb1 + extraNonce2 + coinb2;
    const coinbaseTx = Buffer.from(coinbaseHex, "hex");

    // 2. Compute the merkle root
    let merkle = bitcoin.crypto.hash256(coinbaseTx);
    for (const branch of txids) {
        const branchBuf = Buffer.from(branch, "hex");
        merkle = bitcoin.crypto.hash256(Buffer.concat([merkle, branchBuf]));
    }
    const merkleRootLE = Buffer.from(merkle).reverse();

    // 3. Build the block header
    const versionBuf = Buffer.from(version, "hex");
    const prevHashLE = Buffer.from(prevHash, "hex").reverse();
    const nTimeLE = Buffer.from(nTime, "hex").reverse();
    const bitsBuf = Buffer.from(bits, "hex");
    const nonceLE = Buffer.from(nonce, "hex").reverse();

    const header = Buffer.concat([
        versionBuf,
        prevHashLE,
        merkleRootLE,
        nTimeLE,
        bitsBuf,
        nonceLE
    ]);

    // 4. Add all transactions
    const txCount = fullTxData.length + 1;
    const varintCount = encodeVarInt(txCount);
    console.log("varint: " + varintCount.toString("hex"));
    const txs = [coinbaseTx, ...fullTxData.map(tx => Buffer.from(tx, "hex"))];

    console.log("prevhash", prevHash);
    console.log("current best", await getBestBlockHash());
    console.log("merkleroot", merkleRootLE.toString("hex"));

    const block = Buffer.concat([header, varintCount, ...txs]);
    const blockHex = block.toString("hex");

    // 5. Submit the block
    try {
        await submitBlock(blockHex);
        console.log(`Submitted block ${jobId}: ${blockHex.length} bytes`);
    } catch (err) {
        console.error("RPC submission error:", err.message || err);
    }
}



module.exports = { getJob, submitJob };
