require('dotenv').config();
const { getBlockTemplate, submitBlock, getBestBlockHash } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const { encodeVarInt, swapHexEndian } = require("./helperFunctions");
const bitcoin = require("bitcoinjs-lib");
const {validateShare} = require("./validateShare");
const {dumpBlock} = require("./dumpBlock");
const merkle = require("./merkle");
const database = require("./database");

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
    if (!job) return false;

    const { template, coinb1, coinb2, fullTxData } = job;

    const extranonce1 = submission.extranonce1;       // DO NOT pad
    const extranonce2 = extraNonce2.padStart(8, "0"); // pad miner's ex2

    const coinbaseHex = coinb1 + extranonce1 + extranonce2 + coinb2;
    const coinbaseBuf = Buffer.from(coinbaseHex, "hex");

    // coinbase txid
    const coinbaseHashBE = bitcoin.crypto.hash256(coinbaseBuf);
    const coinbaseHashBEhex = Buffer.from(coinbaseHashBE).toString("hex");

    // txid list in BE
    const txidsBE = template.transactions.map(t => t.txid);

    // prepend real coinbase
    const allTxidsBE = [coinbaseHashBEhex, ...txidsBE];

    // merkle root (LE hex)
    const merkleRootLEhex = merkle.buildRoot(allTxidsBE);
    const merkleRootLE = Buffer.from(merkleRootLEhex, "hex");

    // header fields
    const versionHex = template.version.toString(16).padStart(8, "0");
    const versionLE = Buffer.from(versionHex.match(/../g).reverse().join(""), "hex");

    const prevHash = Buffer.from(template.previousblockhash, "hex").reverse();

    const nTime = Buffer.from(nTimeHex.padStart(8, "0"), "hex").reverse();
    const bits  = Buffer.from(template.bits.padStart(8, "0"), "hex").reverse();
    const nonce = Buffer.from(nonceHex.padStart(8, "0"), "hex").reverse();

    const header = Buffer.concat([
        versionLE,
        prevHash,
        merkleRootLE,
        nTime,
        bits,
        nonce
    ]);

    console.log("versionHex:", versionHex);
    console.log("prevHashLE:", template.previousblockhash);
    console.log("merkleRootLE:", merkleRootLEhex);

    console.log("ntimeHex:", nTimeHex);

    console.log("bitsLE:", bits.toString("hex"));

    console.log("nonceHex:", nonceHex);


    console.log("Header:", header.toString("hex"));
    console.log("Header BE:", header.reverse().toString("hex"));
    console.log("Header length:", header.length);

    shareValidity = validateShare(header, submission.difficulty);

    shareData = {
        // these are the object ids from mongodb
        miner: submission.minerID,
        worker: submission.workerID,
        // raw submission data
        timestamp: Date.now(),
        difficulty: submission.difficulty,
        accepted: shareValidity,
        height: template.height
    }
    database.saveShare(shareData);

    // validate share
    if (!shareValidity) {
        console.log("Share invalid by difficulty");
        return false;
    }

    // build block
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
        return true;
    } catch (err) {
        console.error("RPC submission error:", err.message || err);
        return false;
    }
}


module.exports = { getJob, submitJob };
