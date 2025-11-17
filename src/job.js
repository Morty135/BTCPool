require('dotenv').config();
const { getBlockTemplate, submitBlock, getBestBlockHash } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const { encodeVarInt, swapHexEndian, buildMerkleFromBranches } = require("./helperFunctions");
const bitcoin = require("bitcoinjs-lib");
const {validateShare} = require("./validateShare");
const {dumpBlock} = require("./dumpBlock");

const jobCache = new Map(); // jobId -> full data for block submission



async function getJob() {
    const template = await getBlockTemplate();
    const jobId = Date.now().toString();

    // --- Build coinbase with a unique placeholder for extranonce ---
    const extraNonceMarker = 'ffffffffffffffff';
    const coinbaseTx = buildCoinbaseTx(template, process.env.POOL_ADDRESS, extraNonceMarker);

    const placeholderIndex = coinbaseTx.indexOf(extraNonceMarker);
    if (placeholderIndex === -1)
    throw new Error("Extranonce marker not found in coinbase");

    const coinb1 = coinbaseTx.slice(0, placeholderIndex);
    const coinb2 = coinbaseTx.slice(placeholderIndex + extraNonceMarker.length);

    // --- build the block with bitcoinjs-lib ---
    const block = new bitcoin.Block();
    block.version = template.version;
    block.prevHash = Buffer.from(template.previousblockhash, "hex").reverse();
    block.timestamp = template.curtime;
    block.bits = parseInt(template.bits, 16);
    block.nonce = 0;

    const txs = [bitcoin.Transaction.fromHex(coinbaseTx)];
    for (const t of template.transactions) txs.push(bitcoin.Transaction.fromHex(t.data));
    block.transactions = txs;

    // --- compute merkle branches ---
    const merkleBranches = template.transactions.map(
        tx => Buffer.from(tx.txid, "hex").reverse().toString("hex")
    );

    // --- store what you’ll need for submission ---
    jobCache.set(jobId, {
        template,
        coinb1,
        coinb2,
        fullTxData: template.transactions.map(tx => tx.data),
        merkleBranches
    });

    // --- build stratum notify params ---
    const prevHashLE = Buffer.from(template.previousblockhash, "hex").reverse().toString("hex");
    const versionHex = template.version.toString(16).padStart(8, "0");
    const bitsHex = template.bits.padStart(8, "0");
    const ntimeHex = template.curtime.toString(16).padStart(8, "0");

    return {
        id: null,
        method: "mining.notify",
        params: [
            jobId,
            prevHashLE,
            coinb1,
            coinb2,
            merkleBranches,
            versionHex,
            bitsHex,
            ntimeHex,
            true
        ]
    };
}





const validSharesRate = 0;

async function submitJob(submission) {
    const [username, jobId, extraNonce2, nTime, nonce] = submission.params;
    const job = jobCache.get(jobId);

    usernameSplit = username.split('.');
    const workerName = usernameSplit[1];
    const minerName = usernameSplit[0];

    const { template, coinb1, coinb2, fullTxData } = job;

    // --- rebuild coinbase ---
    // session.id is extranonce1
    const extranonce1 = submission.extranonce1;
    const extraNonce2Fixed = extraNonce2.padStart(8, "0"); 

    if ((extranonce1.length + extraNonce2Fixed.length) !== 16) {
        console.error("Extranonce sizes do not match marker size");
    }

    const coinbaseHex = coinb1 + extranonce1 + extraNonce2Fixed + coinb2;
    const coinbaseTx = Buffer.from(coinbaseHex, "hex");

    // buildMerkleRoot must operate on LE hashes and return LE
    const merkleRoot = buildMerkleFromBranches(coinbaseTx, job.merkleBranches);

    console.log(merkleRoot.toString("hex"));

    // --- build block header manually ---
    const versionLE = Buffer.alloc(4);
    versionLE.writeInt32LE(template.version);
    const prevHashLE = Buffer.from(template.previousblockhash, "hex").reverse();
    const nTimeLE = Buffer.from(nTime, "hex").reverse();
    const bitsLE = Buffer.from(template.bits, "hex").reverse();
    const nonceLE = Buffer.from(nonce, "hex").reverse();

    const header = Buffer.concat([
        versionLE,
        prevHashLE,
        merkleRoot,
        nTimeLE,
        bitsLE,
        nonceLE
    ]);

    const shareValid = validateShare(header, submission.difficulty);

    if (!shareValid) 
    {
        return;
    }

    // --- concatenate transactions (coinbase + all template txs) ---
    const txCount = fullTxData.length + 1;
    const varintCount = encodeVarInt(txCount);
    const txs = [coinbaseTx, ...fullTxData.map(tx => Buffer.from(tx, "hex"))];
    const block = Buffer.concat([header, varintCount, ...txs]);
    const blockHex = block.toString("hex");

    dumpBlock(blockHex, `block_${jobId}.txt`);

    try {
        await submitBlock(blockHex);
        console.log(`Submitted block ${jobId}: ${blockHex.length / 2} bytes`);
    } catch (err) {
        console.error("RPC submission error:", err.message || err);
    }
}



module.exports = { getJob, submitJob };
