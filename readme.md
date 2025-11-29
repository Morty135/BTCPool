The main stratum mining loop is functional.
To run this get a bitcoin node set the .env using the .env_example
Setup mongoDB for authentication.
use nodes RPC and mine away.
The difficulty is fixed to 1 so if you want to test with more powerfull miner change it to a higher one.
CPU test miner included.

Disabled version rolling for bitmain submit logic would break if enabled.

materials for research: https://learnmeabitcoin.com/technical/block/

https://www.rapidtables.com/convert/number/hex-to-decimal.html?x=692377D2
https://learnmeabitcoin.com/technical/block/nonce/
https://learnmeabitcoin.com/technical/block/#header

these sites contain calculators for blockchain use

# expected dataflow:

## template
- previousblockhash (big-endian hex)
- bits (compact target, big-endian)
- version (big-endian)
- curtime (UNIX, big-endian)
- transactions[].txid (big-endian)

## mining.notify
- ID
- prevhash (little-endian)
- coinb1
- coinb2
- merkle branches (each txid reversed)
- version (big-endian)
- nBits (big-endian)
- nTime (big-endian)
- clean jobs (bool)

## mining.submit
- job_id (big-endian)
- extranonce2 (big-endian)
- ntime (big-endian)
- nonce (big-endian)

## submitblock

1. reconstruct the coinbase (big-endian)
2. hash twice (SHA256d)
3. reverse the result (to LE) for the header
### header:
- Version	(little-endian)
- Prev block	(little-endian)
- Merkle root	(little-endian)
- Time (little-endian)
- Bits (little-endian)
- Nonce (little-endian)
### tx:
- (big-endian) as in template
