require('dotenv').config();
const { getBlockTemplate, submitBlock, getBestBlockHash } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const { encodeVarInt, swapHexEndian } = require("./helperFunctions");
const bitcoin = require("bitcoinjs-lib");
const {validateShare} = require("./validateShare");
const {dumpBlock} = require("./dumpBlock");
const merkle = require("./merkle");

const jobCache = new Map(); // jobId -> full data for block submission

const fs = require('fs');

async function getJob() {
    const template = await getBlockTemplate();
    const jobId = Date.now().toString();

    // --- extranonce setup ---
    const EX1_LEN = 8;  // 4 bytes = 8 hex chars
    const EX2_LEN = 8;  // 4 bytes = 8 hex chars
    const TOTAL_LEN = EX1_LEN + EX2_LEN;

    const extraNonceMarker = "ff".repeat(TOTAL_LEN / 2);

    // --- build coinbase ---
    const coinbaseTx = buildCoinbaseTx(
        template,
        process.env.POOL_ADDRESS,
        extraNonceMarker
    );

    // split coinbase
    const idx = coinbaseTx.indexOf(extraNonceMarker);
    if (idx === -1) {
        throw new Error("Extranonce marker missing in coinbase");
    }

    const coinb1 = coinbaseTx.slice(0, idx);
    const coinb2 = coinbaseTx.slice(idx + TOTAL_LEN);

    // --- REAL coinbase hash (LE) ---
    const cbBuf = Buffer.from(coinbaseTx, "hex");
    const cbHashBE = bitcoin.crypto.hash256(cbBuf);
    const cbHashLE = Buffer.from(cbHashBE).reverse();

    // --- REAL merkle branches ---
    const txidsBE = template.transactions.map(t => t.txid);
    const merkleBranches = merkle.buildBranches(cbHashLE, txidsBE);

    // --- header fields ---
    const prevHashLE = Buffer.from(template.previousblockhash, "hex")
        .reverse()
        .toString("hex");

    const versionHex = template.version
        .toString(16)
        .padStart(8, "0");

    const bitsHex = template.bits.padStart(8, "0");
    const ntimeHex = template.curtime.toString(16).padStart(8, "0");

    // --- cache for submit ---
    jobCache.set(jobId, {
        template,
        coinb1,
        coinb2,
        merkleBranches,
        fullTxData: template.transactions.map(tx => tx.data)
    });

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





async function submitJob(submission) {
    const [username, jobId, extraNonce2, nTimeHex, nonceHex] = submission.params;

    const job = jobCache.get(jobId);
    if (!job) {
        console.error("Unknown job ID");
        return false;
    }
    console.log("miner diff: " + submission.difficulty);
    fs.writeFileSync('last_submission.json', JSON.stringify(submission, null, 2));

    const { template, coinb1, coinb2, merkleBranches, fullTxData } = job;

    const extranonce1 = submission.extranonce1.padStart(8, "0");
    const extranonce2 = extraNonce2.padStart(8, "0");

    const coinbaseHex = coinb1 + extranonce1 + extranonce2 + coinb2;
    const coinbaseBuf = Buffer.from(coinbaseHex, "hex");
    console.log("Coinbase:", coinbaseHex);

    // coinbase txid
    const coinbaseHashBE = bitcoin.crypto.hash256(coinbaseBuf);
    const coinbaseHashLE = Buffer.from(coinbaseHashBE).reverse();
    console.log("Coinbase TXID LE:", coinbaseHashLE.toString("hex"));

    // merkle root (LE)
    const merkleRootLE = merkle.buildRootFromBranches(coinbaseHashLE, merkleBranches);
    console.log("Merkle root LE:", merkleRootLE.toString("hex"));

    // header fields
    const versionHex = template.version.toString(16).padStart(8, "0");
    const versionLE = Buffer.from(versionHex.match(/../g).reverse().join(""), "hex");
    const prevHashLE = Buffer.from(template.previousblockhash, "hex").reverse();

    const nTime = Buffer.from(nTimeHex, "hex");
    const bits = Buffer.from(template.bits, "hex");
    const nonce = Buffer.from(nonceHex, "hex");

    const header = Buffer.concat([
        versionLE,
        prevHashLE,
        merkleRootLE,
        nTime,
        bits,
        nonce
    ]);

    console.log("Header:", header.toString("hex"));

    // validate share
    const shareValid = validateShare(header, submission.difficulty);
    if (!shareValid) {
        console.log("Share invalid by difficulty");
        return false;
    }

    // build full block for submission
    const txCount = fullTxData.length + 1;
    const varintCount = encodeVarInt(txCount);
    const txs = [coinbaseBuf, ...fullTxData.map(tx => Buffer.from(tx, "hex"))];

    const blockHex = Buffer.concat([
        header,
        varintCount,
        ...txs
    ]).toString("hex");

    try {
        await submitBlock(blockHex);
        console.log(`Submitted block ${jobId}: ${blockHex.length / 2} bytes`);
        return true;
    } catch (err) {
        console.error("RPC submission error:", err.message || err);
        return false;
    }
}


module.exports = { getJob, submitJob };
