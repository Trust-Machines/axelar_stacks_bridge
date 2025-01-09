import { sha512_256 } from '@noble/hashes/sha512';
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import { bufferCV, listCV, tupleCV, uintCV } from '@stacks/transactions';

function hex_to_bytes(hex: string): Uint8Array {
    hex = hex.replaceAll(' ', '');
    return hexToBytes(hex.substring(0,2) === '0x' ? hex.substring(2) : hex);
}

function tagged_sha512_256(tag: Uint8Array, data: Uint8Array): Uint8Array {
    return sha512_256(new Uint8Array([...tag, ...data]));
}

// https://github.com/stacks-network/stacks-core/blob/eb865279406d0700474748dc77df100cba6fa98e/stacks-common/src/util/hash.rs
class MerkleTree {
    static MERKLE_PATH_LEAF_TAG = new Uint8Array([0x00]);
    static MERKLE_PATH_NODE_TAG = new Uint8Array([0x01]);

    nodes: Uint8Array[][];

    constructor(nodes: Uint8Array[][] = []) {
        this.nodes = nodes;
    }

    static empty(): MerkleTree {
        return new MerkleTree();
    }

    static new(data: Uint8Array[]): MerkleTree {
        if (data.length === 0) {
            return new MerkleTree();
        }

        let leaf_hashes: Uint8Array[] = data.map(buf => MerkleTree.get_leaf_hash(buf));

        // force even number
        if (leaf_hashes.length % 2 !== 0) {
            const dup = leaf_hashes[leaf_hashes.length - 1];
            leaf_hashes.push(dup);
        }

        let nodes: Uint8Array[][] = [leaf_hashes];

        while (true) {
            const current_level = nodes[nodes.length - 1];
            const next_level: Uint8Array[] = [];

            for (let i = 0; i < current_level.length; i += 2) {
                if (i + 1 < current_level.length) {
                    next_level.push(MerkleTree.get_node_hash(current_level[i], current_level[i + 1]));
                } else {
                    next_level.push(current_level[i]);
                }
            }

            // at root
            if (next_level.length === 1) {
                nodes.push(next_level);
                break;
            }

            // force even number
            if (next_level.length % 2 !== 0) {
                const dup = next_level[next_level.length - 1];
                next_level.push(dup);
            }

            nodes.push(next_level);
        }

        return new MerkleTree(nodes);
    }

    static get_leaf_hash(leaf_data: Uint8Array): Uint8Array {
        return tagged_sha512_256(MerkleTree.MERKLE_PATH_LEAF_TAG, leaf_data);
    }

    static get_node_hash(left: Uint8Array, right: Uint8Array): Uint8Array {
        return tagged_sha512_256(MerkleTree.MERKLE_PATH_NODE_TAG, new Uint8Array([...left, ...right]));
    }

    proof(index: number) {
        if (this.nodes.length === 0) {
            return [];
        }
        if (index > this.nodes[0].length-1) {
            throw new Error("Index out of bounds");
        }
        const depth = this.nodes.length - 1;
        const path = Math.pow(2, depth) + index;

        let proof = [];
        let position = index;
        for (let level = 0 ; level < depth ; ++level) {
            const left = ((1 << level) & path) > 0;
            proof.push(this.nodes[level][position + (left ? -1 : 1)]);
            position = ~~(position / 2);
        }

        return proof;
    }

    root(): Uint8Array {
        if (this.nodes.length === 0) {
            return new Uint8Array(32);
        }
        return this.nodes[this.nodes.length - 1][0];
    }

    pretty_print() {
        let str = '';
        for (let level = this.nodes.length-1 ; level >= 0 ; --level) {
            const whitespace = " ".repeat((this.nodes.length-level-1)*2);
            str += this.nodes[level].map(node => whitespace+bytesToHex(node)+"\n").join('');
        }
        return str;
    }
}

function block_header_hash(
    version: Uint8Array, // 1 byte
    chain_length: Uint8Array, // 8 bytes
    burn_spent: Uint8Array, // 8 bytes
    consensus_hash: Uint8Array, // 20 bytes
    parent_block_id: Uint8Array, // 32 bytes
    tx_merkle_root: Uint8Array, // 32 bytes
    state_index_root: Uint8Array, // 32 bytes
    timestamp: Uint8Array, // 8 bytes
    miner_signature: Uint8Array, // 65 bytes
    signer_bitvec: Uint8Array // 2 bytes bitvec bit count + 4 bytes buffer length + bitvec buffer
) {
    return sha512_256(new Uint8Array([  
        ...version,
        ...chain_length,
        ...burn_spent,
        ...consensus_hash,
        ...parent_block_id,
        ...tx_merkle_root,
        ...state_index_root,
        ...timestamp,
        ...miner_signature,
        ...signer_bitvec
    ]));
}

function block_index_header_hash(block_sighash: Uint8Array, consensus_hash: Uint8Array): Uint8Array {
    return sha512_256(new Uint8Array([...block_sighash, ...consensus_hash]));
}

function proof_path_to_cv(tx_index: number, hashes: Uint8Array[], tree_depth: number) {
    return tupleCV({
        "tx-index": uintCV(tx_index),
        "hashes": listCV(hashes.map(bufferCV)),
        "tree-depth": uintCV(tree_depth)
    });
}

function example() {
    //block: https: //api.hiro.so/extended/v2/blocks/438372
    const block_info = {
        "canonical": true,
        "height": 438372,
        "hash": "0xba4103daab4661a569ddf355f2bec99322298e49b8bdab33a431aadac98c2b36",
        "block_time": 1736345563,
        "block_time_iso": "2025-01-08T14:12:43.000Z",
        "tenure_height": 180735,
        "index_block_hash": "0x4c017d113358c2541f2e8b92a7ed1a33c842728878bcf79b1ddc42c1768032a0",
        "parent_block_hash": "0xf21399a3c6778770d6eabf16a0715c3b090d63989b838207248ed98ee9a61ecb",
        "parent_index_block_hash": "0xd7039979ef223a52b3112fede246066c1b3be96acc3f0e47c345b332c0aebf96",
        "burn_block_time": 1736343863,
        "burn_block_time_iso": "2025-01-08T13:44:23.000Z",
        "burn_block_hash": "0x00000000000000000001d319d6686c96bba97e3d4b1a3e0684aad85be63a277e",
        "burn_block_height": 878351,
        "miner_txid": "0xcfd30dbd71f68387157be9c7b3d5c422045df24590507a3ca26b6d03d1e78753",
        "tx_count": 2,
        "execution_cost_read_count": 103,
        "execution_cost_read_length": 217588,
        "execution_cost_runtime": 593641,
        "execution_cost_write_count": 5,
        "execution_cost_write_length": 675
    };

    const block_consensus_hash = '8077a657f82aac6012166525de0c5b53a3008c03';

    const block_txids = [
        "0xfd8f80b3ddc4b918c4a6238a70c766280d748dbebdcf984186791030cad9179a",
        "0x354cb88c5c1dd0cde02590fdfa9b06ee1a97b3b873be79ac3664b132c3e095f9"
    ];

    const block_tx_merkle_root = "e9414d181f9dc949115bc057b98a0d75348e54c05ff8287e3bb80c95872c0403";

    /*
    Block layout:

    00 - version
    000000000006b064 - chain length
    0000005cc4e4fab4 - burn spent
    8077a657f82aac6012166525de0c5b53a3008c03 - consensus hash
    d7039979ef223a52b3112fede246066c1b3be96acc3f0e47c345b332c0aebf96 - parent block hash
    e9414d181f9dc949115bc057b98a0d75348e54c05ff8287e3bb80c95872c0403 - tx merkle root
    8d6299532a78ff61705d4e4867644b1aec6ec069376f387faaa464591b7eb202 - state root
    00000000677e87db - timestamp
    00b57b3fde1c8bce6a9364f9e47fa6a65d3c3a5bc76d377ed8a74546a718ab475d2b20dd591a003501624e6a842484a162c7ffccb857f4a78d76caae6366a33cd7 - miner signature
    00000014 - signer signature count
    007e8cb07951f28c9b6b99ea5aa9237dc7b3cc27b6c3ca92296dde9e691bd557c12fa01f1c7679f62c3c321bb3d86f675c370cfd2b23da5a70ac9ef0e1adbb97d0 - signer signatures
    007467b27153049fa8e41187de38530148b703d2752c34dcf627cafb8b47c9d55743c9b5fd22d1f594d8861807f4141f32891f6328618dcf383a130ce5d4b79069
    01b62dfb71f37f92cc6b3a5204626c3e2df8910e0a44a33aaf2575d91b6949cfc80eb718ef692b5c70ee710f5a58dc692de4980876c3c0bb0183c9f8c5d33256c3
    01f0a1557b05dc9da978d24ac5a89f50d8821665a8ece7f5f60b0857176f020fc0099541c112527fb59c6e22f6f4c0fb998e6ea610508820a1f62d53dd1bed7a83
    00a965bd21a6848e2cfd4f22bfe355270569ca8d036a8a0e0956f699b8a6c313866ea247630fdb8791c9407e030d564a48da4c3d56129017eb65f0f24256cae0d3
    00eda58c7664cc4270a94764b13c6180d4f5988870856463eef0fc63975dadc0882553fe1205653c3148cad926e9c3f321fa963ed8a80ccf2148004a2a4d4af9de
    00d9d775837649928b32a14840b31629f95ad4ab3585220bf3a844afcb507fef124978cd57c55f6350ad60ad2474457e55e277db6cf8377d5ff893016c60192398
    008ae1d24927af6b682fa2b199cabd094f911ade725360bbabf402cffcd925f17222d3148f250ee67b1bd367113c2c7a13dc381dbf667762588eb8cb48341ce7f1
    01d7ab98aa0b4249a0f5a5fd9ff18622b36a7a10f8f411a5200f52e4c653079b860a357546c5dda85cfacf73ca67747a0ca5b26c9c4c5442c77b2418e2ecd8e01a
    000cc8b19de661474bc2d53da4d3d0cc0e431386b04290586c54d9d2caa0869a0d4522a18efe5c39a888ebaea55e0b5f07f11354cdb560309c16749c73be03b579
    0095c9bba8f5c9ab8c979a3f6293c939337fd7d1ce84e2452d1bf546100a09f7e018de2ee24218e1f3468cd967811873ee8f8b559f341f083bd34b0a91d1de546b
    003af83dba80a26260ab5e5fe774d92b944e1e133d94dd27ef8b443831ff406c115980a05cf71d4d11cee9705c9970cf011b02a0f9198c18e3c244618486f04fff
    010236c15f5fb370db4b6101c6f21f94bc166dd5f42267870c9aa3a01f4cfc8c0c065a7568e870a91c6ebe6280ad078992a83c7af7a2cbbe6b2fc5a94a69723e98
    017593f306eac4913ce4c689220ad9b4cfe87b77f60e50f0c50fdcd96177607e936ba3b84953ca9d0a649dc67dcb647f97ddf0536361105d61409588b5eec6ebb4
    01b8798d9097742e7b78aae992744d714a646ef28f9207c695370bce0c8cdf1ae65a4aa25cd5d7c49a443d39c22f19ca6e191ac6a988870180964a0cb1dd424d4d
    014e9f6201f8f085a4b1cbbce4045bfdabdfac819b4f1542050c5787f9afcff8f9386bbc585546b609e6bc26fc5066e8bc3176811b1813681703b9bb3192837813
    00d9f8586e933e3b0cdc7a784b2d6379e4dc62f1e6075770e885c7adcf1ed41a767c12b6761e2381caa7d90e193048989de7206e48b43126a89c6a80409fe336c7
    00a695a65b6c83daf301b5ed1f90dc7842ed9ea57e774fe0e4638b5c5a6e3ff3724baf51901d9294a523ef108ea0b62486b6f80c49ca34e8d84f3401da7d111e0e
    0115c2a5e92204a27a66ecb1df66be399e43536fa4e2bf62ae482136c1b7a607677faceeb6ff8ef1cbf5a26e26bd0ba8b5a7e4e8b2b012e6f9413f8d0314d37dcd
    00d5b1106dcd197e3eaaa5e5969e7eb1350dc7c09e50da1adef7369ae45c52f3c213b8c59cce0bad14884f0e26f95eed666e9318569ddde5671084e8fb297de5f9
    0ec9 - signer bitvec length
    000001da - signer bitvec byte length
    - bitvec buffer
    ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01
    00000002 -- tx count
    --- tx 1
    00000000010400c96dc19fafcf7bf1b42c59faa88e0ea5fcd8ef6c000000000000034b0000000000055c33000088e497445b9165f31e9ec591ae886d4cafd1ea365a0c772642e2e1a517626bde164eb86017967506b0f48d60c08114b6f0aa997510d03645bc7976ac53d802be0302000000000005162fbde0255efaa0354d12463d045c3291b3cc1a8b00000000000f638d00000000000000000000000000000000000000000000000000000000000000000000
    -- tx 2
    00000000010400a4e680bdfe8804b7fe69a4a64948c558558293a7000000000000000d00000000000027100001a039ec812f2b59f0967e6d71be072de17282e73fd661f8b01d587c0a4ea3f54d0d8bc1743d8f40a9990c304d523fb1561131dc34abdf523b478e79858559c30d030200000002010216a4e680bdfe8804b7fe69a4a64948c558558293a716eae2820eebe09cfe1ad1436203a264fd9f958c271477656c7368636f726769636f696e2d746f6b656e0e77656c7368636f726769636f696e01000000001dcd6500000316402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0f616d6d2d7661756c742d76322d303103000000000005471002162ec1a2dc2904ebc8b408598116c75e42c51afa2612777261707065722d616c65782d762d322d310b737761702d68656c706572000000050616402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0c746f6b656e2d77636f7267690616402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0d746f6b656e2d777374782d76320100000000000000000000000005f5e1000100000000000000000000000ba43b74000a01000000000000000000000000020fc266
    */

    const txids = block_txids.map(txid => hex_to_bytes(txid));
    const tx_merkle_tree = MerkleTree.new(txids);

    const root = tx_merkle_tree.root();

    const block_version = hex_to_bytes('00');
    const chain_length = hex_to_bytes('000000000006b064');
    const burn_spent = hex_to_bytes('0000005cc4e4fab4');
    const consensus_hash = hex_to_bytes(block_consensus_hash);
    const parent_block_id = hex_to_bytes(block_info.parent_index_block_hash);
    const tx_merkle_root = hex_to_bytes(block_tx_merkle_root);
    const state_root = hex_to_bytes('8d6299532a78ff61705d4e4867644b1aec6ec069376f387faaa464591b7eb202');
    const timestamp = hex_to_bytes('00000000677e87db');
    const miner_signature = hex_to_bytes('00b57b3fde1c8bce6a9364f9e47fa6a65d3c3a5bc76d377ed8a74546a718ab475d2b20dd591a003501624e6a842484a162c7ffccb857f4a78d76caae6366a33cd7');
    // signer bitvec structure: bit count (2 bytes) + bitvec byte length (4 bytes) + bitvec buffer
    // signer bitvec bit count 0x0ec9 = 3785
    // byte length of bitvec 0x000001da = 474
    const signer_bitvec = hex_to_bytes('0ec9000001daffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01');

    const block_sighash = block_header_hash(
        block_version,
        chain_length,
        burn_spent,
        consensus_hash,
        parent_block_id,
        tx_merkle_root,
        state_root,
        timestamp,
        miner_signature,
        signer_bitvec
    );
    const block_id = block_index_header_hash(block_sighash, consensus_hash);

    console.log('calculated merkle root  ', bytesToHex(root));
    console.log('expected merkle root    ', block_tx_merkle_root);

    console.log('calculated block_sighash', bytesToHex(block_sighash));
    console.log('expected block_sighash  ', block_info.hash.substring(2));

    console.log('calculated block_id     ', bytesToHex(block_id));
    console.log('expected block_id       ', block_info.index_block_hash.substring(2));

    console.log("tree\n", tx_merkle_tree.pretty_print());
    console.log('tx1 proof', tx_merkle_tree.proof(0).map(bytesToHex));
    console.log('tx2 proof', tx_merkle_tree.proof(1).map(bytesToHex));

    console.log('proof CV', proof_path_to_cv(1, tx_merkle_tree.proof(1), 1));

    // In clarinet console:
    // (contract-call? .clarity-stacks verify-merkle-proof 0x354cb88c5c1dd0cde02590fdfa9b06ee1a97b3b873be79ac3664b132c3e095f9 0xe9414d181f9dc949115bc057b98a0d75348e54c05ff8287e3bb80c95872c0403 { tx-index: u1, hashes: (list 0xb1b978e7232c205add86e5b1e410ba7b8d13b9cab2687c8d425303c0c26c4d3f), tree-depth: u1 })
    // (ok true)
    //
    // (contract-call? .clarity-stacks debug-set-block-header-hash u438372 0xba4103daab4661a569ddf355f2bec99322298e49b8bdab33a431aadac98c2b36)
    // (ok true)
    // (contract-call? .clarity-stacks was-tx-mined-compact 0x354cb88c5c1dd0cde02590fdfa9b06ee1a97b3b873be79ac3664b132c3e095f9 { tx-index: u1, hashes: (list 0xb1b978e7232c205add86e5b1e410ba7b8d13b9cab2687c8d425303c0c26c4d3f), tree-depth: u1 } u438372 0x00000000000006b0640000005cc4e4fab48077a657f82aac6012166525de0c5b53a3008c03d7039979ef223a52b3112fede246066c1b3be96acc3f0e47c345b332c0aebf96e9414d181f9dc949115bc057b98a0d75348e54c05ff8287e3bb80c95872c04038d6299532a78ff61705d4e4867644b1aec6ec069376f387faaa464591b7eb20200000000677e87db00b57b3fde1c8bce6a9364f9e47fa6a65d3c3a5bc76d377ed8a74546a718ab475d2b20dd591a003501624e6a842484a162c7ffccb857f4a78d76caae6366a33cd70ec9000001daffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff01)
    // (ok true)
}

example();
