require('dotenv').config();
const { getBlockTemplate, submitBlock, getBestBlockHash } = require("./daemon");
const { buildCoinbaseTx } = require("./coinbase");
const bitcoin = require("bitcoinjs-lib");
const {validateShare} = require("./validateShare");
const {dumpBlock} = require("./dumpBlock");
const merkle = require("./merkle");
const database = require("./database");
const utilities = require("./utilities");
const fs = require('fs');
const { Z_ERRNO } = require('zlib');

const jobCache = new Map(); // jobId -> full data for block submission

async function getJob(extranonce1) {
    const template = await getBlockTemplate();
    const jobId = Date.now().toString();

    // --- extranonce setup --
    const EX2_BYTES = 4; // 4 bytes

    const zeroBuffer = Buffer.from([0x00]);

    // --- build coinbase ---
    const coinbaseTx = buildCoinbaseTx(
        template,
        process.env.POOL_ADDRESS,
        extranonce1,
        zeroBuffer
    );

    console.log("Coinbase TX:", coinbaseTx);

    // --- split coinbase ---

    const splitMarker = 
        extranonce1 + 
        zeroBuffer.toString("hex");   // the OP_0 byte

    const start = coinbaseTx.indexOf(splitMarker);
        if (start === -1) throw new Error("prefix not found");

    const end = start + splitMarker.length;

    const coinb1 = coinbaseTx.slice(0, end);
    const coinb2 = coinbaseTx.slice(end);

    console.log("Coinbase Part 1:", coinb1);
    console.log("Coinbase Part 2:", coinb2);

    // --- merkle branches ---
    const txids = template.transactions.map(tx => tx.txid);
    const branches = merkle.branches(txids);

    // --- header fields ---
    const prevHashLE = Buffer.from(template.previousblockhash, "hex")
        .reverse()
        .toString("hex");

    const version = template.version.toString(16).padStart(8, "0");
    const nBits = template.bits
    const nTime = template.curtime.toString(16).padStart(8, "0")

    // --- cache for submit ---
    jobCache.set(jobId, {
        version,
        bits: nBits,
        ntimeInit: nTime,
        prevhashBE: template.previousblockhash,
        prevhashLE: prevHashLE,
        coinb1,
        coinb2,
        extranonce2_size: EX2_BYTES,
        txids,
        branches,
        height: template.height,
    });

    const job = {
        id: null,
        method: "mining.notify",
        params: [
            jobId,
            prevHashLE,
            coinb1,
            coinb2,
            branches,
            version,
            nBits,
            nTime,
            true
        ]
    };

    return job;
}





async function submitJob(submission) {
    const [username, jobId, extraNonce2, nTimeHex, nonceHex] = submission.params;
    const minerVersion = submission.params[5];

    const job = jobCache.get(jobId);
    if (!job) return false;

    const jobData = {
        //--- miner submission ---
        username,                 // "miner.worker"
        jobId,                    // "1764457448832"
        extranonce2: extraNonce2, // raw miner ex2 (hex string)
        nTimeMiner: nTimeHex,     // miner-submitted ntime (BE hex)
        nonce: nonceHex,          // miner-submitted nonce (BE hex)
        receivedAt: submission.receivedAt,

        //--- session-level data ---
        extranonce1: submission.extranonce1,  // from session
        difficulty: submission.difficulty,
        minerID: submission.minerID,
        workerID: submission.workerID,

        //--- job-level data (from jobCache) ---
        versionBE: minerVersion || job.version,
        bitsBE: job.bits,
        ntimeInitBE: job.ntimeInit,        // template's initial nTime
        prevhashLE: job.prevhashLE,        // for header
        prevhashBE: job.prevhashBE,        // optional (for block assembly)

        coinb1: job.coinb1,
        coinb2: job.coinb2,

        extranonce2_size: job.extranonce2_size,

        branchesLE: job.branches,          // merkle siblings (LE hex)
        txidsBE: job.txids,                // optional, huge, but fine

        height: job.height,
        cleanJobs: job.cleanJobs,
        jobCreatedAt: job.created
    };

    const ex1 = jobData.extranonce1;            
    const ex2 = jobData.extranonce2.padStart(jobData.extranonce2_size * 2, "0");

    const coinbaseHex = jobData.coinb1 + ex1 + ex2 + jobData.coinb2;
    const coinbase = Buffer.from(coinbaseHex, "hex");
    const coinbaseHashBE = utilities.sha256d(coinbase);  // BE

    let root = coinbaseHashBE;

    for (const branchLE of jobData.branchesLE) {
        const branchBE = Buffer.from(branchLE, "hex").reverse();  
        root = utilities.sha256d(Buffer.concat([root, branchBE]));
    }

    const merkleRootLE = Buffer.from(root).reverse().toString("hex");

    const headerHex =
    Buffer.from(jobData.versionBE, "hex").reverse().toString("hex") +
    jobData.prevhashLE +                                  // already LE
    merkleRootLE +                                        // LE
    Buffer.from(jobData.nTimeMiner, "hex").reverse().toString("hex") +
    jobData.bitsBE +
    Buffer.from(jobData.nonce, "hex").reverse().toString("hex");

    const header = Buffer.from(headerHex, "hex");

    const headerHashBE = utilities.sha256d(header);        // BE
    const hashValue = BigInt("0x" + headerHashBE.toString("hex"))

    // share target
    const DIFF1 = BigInt("0x00000000FFFF0000000000000000000000000000000000000000000000000000");
    const target = DIFF1 / BigInt(jobData.difficulty);

    const shareDiff = Number(DIFF1 / hashValue);
    console.log("effective share diff ~= ", shareDiff);

    const isShareValid = hashValue <= target;

    shareData = {
        // these are the object ids from mongodb
        miner: submission.minerID,
        worker: submission.workerID,
        // raw submission data
        timestamp: Date.now(),
        difficulty: submission.difficulty,
        accepted: isShareValid,
        height: jobData.height
    }
    database.saveShare(shareData);

    console.log("JOB VS SUBMIT:");
    console.log("  versionBE:", jobData.versionBE);
    console.log("  prevhashLE:", jobData.prevhashLE);
    console.log("  nTimeMiner:", jobData.nTimeMiner);
    console.log("  nonce:", jobData.nonce);
    console.log("  ex1:", ex1);
    console.log("  ex2:", ex2);
    console.log("  merkleRootLE:", merkleRootLE);
    console.log("  header:", headerHex);
    console.log("  hash:", headerHashBE.toString("hex"));

    // validate share
    if (!isShareValid) {
        console.log("Share invalid by difficulty");
        return false;
    }

    // build block
    const txCount = fullTxData.length + 1;
    const varintCount = utilities.encodeVarInt(txCount);
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
