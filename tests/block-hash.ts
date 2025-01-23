import { sha512_256 } from "@noble/hashes/sha512";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import {
  bufferCV,
  Cl,
  deserializeTransaction,
  listCV,
  tupleCV,
  uintCV,
} from "@stacks/transactions";

function tagged_sha512_256(tag: Uint8Array, data: Uint8Array): Uint8Array {
  return sha512_256(new Uint8Array([...tag, ...data]));
}

// https://github.com/stacks-network/stacks-core/blob/eb865279406d0700474748dc77df100cba6fa98e/stacks-common/src/util/hash.rs
export class MerkleTree {
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

    let leaf_hashes: Uint8Array[] = data.map((buf) =>
      MerkleTree.get_leaf_hash(buf),
    );

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
          next_level.push(
            MerkleTree.get_node_hash(current_level[i], current_level[i + 1]),
          );
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
    return tagged_sha512_256(
      MerkleTree.MERKLE_PATH_NODE_TAG,
      new Uint8Array([...left, ...right]),
    );
  }

  proof(index: number) {
    if (this.nodes.length === 0) {
      return [];
    }
    if (index > this.nodes[0].length - 1) {
      throw new Error("Index out of bounds");
    }
    const depth = this.nodes.length - 1;
    const path = Math.pow(2, depth) + index;

    let proof = [];
    let position = index;
    for (let level = 0; level < depth; ++level) {
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
    let str = "";
    for (let level = this.nodes.length - 1; level >= 0; --level) {
      const whitespace = " ".repeat((this.nodes.length - level - 1) * 2);
      str += this.nodes[level]
        .map((node) => whitespace + bytesToHex(node) + "\n")
        .join("");
    }
    return str;
  }
}

export function block_header_hash(
  version: Uint8Array, // 1 byte
  chain_length: Uint8Array, // 8 bytes
  burn_spent: Uint8Array, // 8 bytes
  consensus_hash: Uint8Array, // 20 bytes
  parent_block_id: Uint8Array, // 32 bytes
  tx_merkle_root: Uint8Array, // 32 bytes
  state_index_root: Uint8Array, // 32 bytes
  timestamp: Uint8Array, // 8 bytes
  miner_signature: Uint8Array, // 65 bytes
  signer_bitvec: Uint8Array, // 2 bytes bitvec bit count + 4 bytes buffer length + bitvec buffer
) {
  return sha512_256(
    new Uint8Array([
      ...version,
      ...chain_length,
      ...burn_spent,
      ...consensus_hash,
      ...parent_block_id,
      ...tx_merkle_root,
      ...state_index_root,
      ...timestamp,
      ...miner_signature,
      ...signer_bitvec,
    ]),
  );
}

export function block_index_header_hash(
  block_sighash: Uint8Array,
  consensus_hash: Uint8Array,
): Uint8Array {
  return sha512_256(new Uint8Array([...block_sighash, ...consensus_hash]));
}

export function proof_path_to_cv(
  tx_index: number,
  hashes: Uint8Array[],
  tree_depth: number,
) {
  return tupleCV({
    "tx-index": uintCV(tx_index),
    hashes: listCV(hashes.map(bufferCV)),
    "tree-depth": uintCV(tree_depth),
  });
}

export function exampleTxProof() {
  // const block_info = await fetch("https://api.hiro.so/extended/v2/blocks/443049")
  //     .then(res => res.json());

  // const block = await ((await fetch("https://api.hiro.so/v3/blocks/height/443049")).arrayBuffer())
  const block = hexToBytes(
    `00000000000006c2a90000005cd0f61f04f9cfc3b622d05f0a78d4e81212ad0fb41f3dce5874b42967e0012d9aa457dbe36169f3ea824afe6766f9f02c47d9bad479672e2f07c751921e36ec2ea58959c069f39c2eab6eef80581984a5cf5658dccdae472eca22cb03c166cc14f407777241f3a9fce5546cc74d5da4f7e31fa378936e3e0600000000677fee7c00e2c5f5bdfaead3d9f76147309cf7941b90903a503c2950e88507c963a9fc30517ecf1b03983f3b574dd895b0e293f73e95ec8fef1ec2c99a053747cdc6a6b0140000001701c233050db366f976e2ef14a2b10a369f7d3985bee493d679f59d4477ddc9cfee543767b8da504a9e14e9fec664238b362d1b7a2569808d506f30a9b87fcb14e00134474b061e387c090c85a1e03ee5397a63a80d2b4356e43295094e346358ec5460cc01f384efc081c60ad207fe9a6e407812d05d9733b6e5bda54c66c967cf7000f3af8b31c0a44ce8d4b3e677282c12172e396601282971cfe67ab5d99b4262093425f27f7e926aaa5b6d87278dc821f5d11528a20ba616fe0786887ae0a1de08005aed08459e61ab03bea31c38967434d4e5f249c63419ad66745cebec645a761f3902bd6933cd906a4e7ffb5004f1cf5560885faf6c5a0478000bbe5f9dc39a47003a430714516c9fc37b61d84f93c4b25b7f5be39763f3660fc66a6fa977379eae55bd84042faa92c6f51112604acb82b98e165db5afeba3e3d33ec8c3444120e90087bd3074b5a601290117d56e0728a74f5cb1551965fa1877c8bfba81e6bf242b2e5365851c5231b7b4f3ef4999e3c402e7fbe1abb5390989813266d1614323d10049bb8030975d1645fe5b98856218920fc60a13216b12fbb69fc7047afd9354653c9080884f93b1a2d2fd1f701123ffb610827dec8ba6f7cdcdfd044d029f0b190091c8df6eca9cef91c46f1328e878e6b55b3ddb055677d1b7a787a081075b7cdf248228dc443e989119c9716ac38f808d4446111f2a033b7ed39dd60e504bf3810025c623f64ce976e125097adf9313020eea7ea5cef56e756f0123852bb078653d11f6eee5aaecbc3733e3caea613b6a3a29e07cb4e0934974da9989d44e0437980098238a96e5251a93997bce28f189a2087ba65b3f4620399e51dabe022594ddc3136afbe341702d74fd384154c3608c0346f80cbdbeed98322779a381864883a801f9d0f368c67a7caaa3d4016c06935c3d9df6a3e95ba334e94cffee2d489581374b73b7e119ac89bf8a9cac68b9a1072be4f78741e002d9cc44b16426f7ca762d01d95e1199db66e8b3c6798eb7b39ba0c59b5aca7c2eaed7aa24f60e0113cdeba67888f6a2c1ebe272870d7c61d1b2dce76b535a0ef2e23deb1c4b202e2371fee500926e0e208677a77f629b155b6025c0f99d321e7e4ddadfff8bec30ec88f167f82a186e454f52bdba9311b161bc4818303ced4e60e07251f9ca9f2ba821082f9c006d7e81027f74070a6cb7aed6b9eba0a64c7c59c25561c427f8f2038dd9d24ae344941053f573f1e72815b6868203feb1c37794c3141e5530dc2b8e233ed445f3018fba137eb8e62407050400ab7905108b6b7277772255da7049164feaa2298e0747645fb6592adf22b143ea8ab5e0134cd8ec420022594ae3a4ce41eb79709cea0092243a30ead945a8b215cc582efbb89da9bec2a393e988ace138bc9da2f74e26146878f030d750199adf6f956d72f67d7dba430fbb10fb20299199cc1fd0ffff002ffc01c30c2af369f68a5528be8453923542e5a25cd154718cfe9d67e4669c861bce5bea08976023b955aebc60f75bc9d4053efd93af8d28fee493cf0c0bd091003d3c5b2d679bf837a01aa287fcc6f36a10cdbfaf80396a97c5fc8a59b2f244ba47748d99e487de5a8fd95805676afcd5ffec6cd49266b7ea2e51a98340fbc70400d5e1d0ec61e121757fdd66b2027201beadb516497bdd50dbde9c994d90af470a6275bb12b715f369a0ca2706310b0b7a9800e2fb5aecaa638616b58e30773a8e00d37e4f7223ae2874ab5d8bd36e66ffbb274071b6d6d9005045d71d30b72aae861a3fb6e1032c2351e994c577e790433321049b28c7e0175d64dfaa783b2a041100631f1e32b34dd572c6fc71c30cc8cf5303e4db4f87c66a170f0ef2a539b913bc1cf0a21e9c4d5e05effbed2b657daa73753905c00af832ea3e5c14ff21af336f00c48a7b51398067700b4772550cc0c3eaf2a0bd249bc6a2e64de1c4c28209e02020bba0fe24a6557fb0ba7c62de44e6fa66c87b9d27d319a3648eb35d382949a301b69cc356a2a342694c9a2a6e47ebd89c17a2759777753408556751083bfde1c33659fce2fa449403079c136b78d93791646d7fa13ce16f22a36b9ad98ebca5760ec9000001daffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff010000000d00000000010400e3d94a92b80d0aabe8ef1b50de84449cd61ad6370000000000003b3800000000000f42400101d5f72b69081bd4b574ec42a2407f08b3aa09050c47e067364fa727fac79ea4585a080f8aaa85c325f54c9ed2882f68a46b19bf98fcb4bccf271fa4e29a12bf47030200000001010216e3d94a92b80d0aabe8ef1b50de84449cd61ad6371662138c7b2d3e3cfd3dc712f9fa0efe8126c1cb47126d69616d69636f696e2d746f6b656e2d7632096d69616d69636f696e010000002b01888261021662138c7b2d3e3cfd3dc712f9fa0efe8126c1cb47126d69616d69636f696e2d746f6b656e2d7632087472616e73666572000000040100000000000000000000002b018882610516e3d94a92b80d0aabe8ef1b50de84449cd61ad63705162a3f8900395bcb3bc6a294052cc5b2690de7d76a0a0200000001310000000001040091a611f1f67a61d4efd6ca651a1271560e1d3c0f0000000000002bf7000000000007a12001017b4c704b0711a883858f5d79a6f6ed4214afff613c28152ab6044af2efa66b4629d18ef950194deb2bd81c9487419ab678dfebfc7449076ce9d594e943ba8dc80302000000000005168eaaec85b31504a2d07a850dd5333dfde0cf9cc8000000013ed1bca0313032353630333100000000000000000000000000000000000000000000000000000000000001040094dd134ada459b2eb61f1c985a4113ccc9c3947400000000000077b100000000000493e001017f7f1bdadd26213f6d2c1fedf1b80208c70df6e924dc0ecc3d10fda30d366d8029790053037afdc7ddc3f47e1473be98e0b536cf15de084f6c8b119fa06486e3030200000000000516ef2e68aeb0eb060e598b506368d25adbedd294060000000307453d00000000000000000000000000000000000000000000000000000000000000000000000000000001040025552bb08f43d41f4dc362a54f52b558118ef065000000000000000300000000000072db0100ec223f6f3c3dc5535484d90b3459b32f5825c03bd45854f787bcb99a119dceee486f0a55d715c3571400173e490fa9cd854bfd23c053282f95e2612430aacb9803020000000101021625552bb08f43d41f4dc362a54f52b558118ef06516099fb88926d82f30b2f40eaf3ee423cb725bdb3b0b73747374782d746f6b656e0573747374780100000000060523400216099fb88926d82f30b2f40eaf3ee423cb725bdb3b0b73747374782d746f6b656e087472616e73666572000000040100000000000000000000000006052340051625552bb08f43d41f4dc362a54f52b558118ef0650516561a68a05f1ef9ecf1c436995373f89f59f37be90a020000000000000000010400b1cea24140fb4999cd1a78e2ea0d1119f7f21063000000000000096f000000000003002c0001d3c61c4f8e8fd963f55866217dd2f921cba9dfad8dbad516d19e430380eff2753c5063146cf58190967ade0b8a0b0d2f27a15952d9e97a1bcc633b51eba7a2b003010000000002160c71fc8bb2c9838c654cd31714af17521d9572d51b63726f73732d7065672d696e2d656e64706f696e742d76322d3034117472616e736665722d746f2d63726f7373000000040c000000080f616d6f756e742d696e2d666978656401000000000000000000000000004c65810d646573742d636861696e2d6964090466726f6d0200000014ebf6d047effda8665bf0006a960790b09ac1d4330473616c740200000020ce6ec6a1dcfb6bd73f659a2ffcefa81fcf2ad065af02eaa6ab41538d0818b6a50c7372632d636861696e2d6964010000000000000000000000000000000202746f02000000142a6b58cae7437ef906a1bba4dbc653d39c50d89a08746f6b656e2d696e06160c71fc8bb2c9838c654cd31714af17521d9572d50a746f6b656e2d7762746309746f6b656e2d6f75740616bad390278c2d8d61d49bce446eaebd9b8c0314550a746f6b656e2d6162746306160c71fc8bb2c9838c654cd31714af17521d9572d50a746f6b656e2d776274630616bad390278c2d8d61d49bce446eaebd9b8c0314550a746f6b656e2d616274630b000000040c000000030a6f726465722d686173680200000020a1dc2e362a9a5f478ea4d7d4e800d400a78fd8e9ce599ad5d1b615e56737cc74097369676e61747572650200000041c37cfdcdbc56665a741bfa7e9e3e023dbadd819a379013cafed3f881950ff5401a0b4672d18cf2ab3a12421a8e4c3f7f75bdb3f38cc87a534ec5af4e7d94a1c800067369676e65720516520b888f7b69228b36447eb9cba646d2870e08380c000000030a6f726465722d686173680200000020a1dc2e362a9a5f478ea4d7d4e800d400a78fd8e9ce599ad5d1b615e56737cc74097369676e617475726502000000414689d046e83da34d7751b41a596b923394f84535ba4e79f49fb066e9935892a566b05e81fd3c1c39c35fa04d2b852b5e27f05b978808573f44ebd7bd8c0d018701067369676e6572051687d8f7c4198d2ee6178738735b52769d1420ba560c000000030a6f726465722d686173680200000020a1dc2e362a9a5f478ea4d7d4e800d400a78fd8e9ce599ad5d1b615e56737cc74097369676e617475726502000000419fdadeb72073408f632d1e1039733f24951ffc6e281c22bb9e6c88a8f1ca68000002f356821efdabe38b983a28dea25b8c56196c39d70866f6f89c919a10776800067369676e65720516ac00a0055e0c70479c7db0f7e08fe8657d0206c70c000000030a6f726465722d686173680200000020a1dc2e362a9a5f478ea4d7d4e800d400a78fd8e9ce599ad5d1b615e56737cc74097369676e6174757265020000004140f09db69c93b483ddc63f000cc40ec14b9525a12fee025de3ccb55cc7988b9725ae8ef7aa4f6b94e94406adc761b0eb1d543277307798657bf5659df491671100067369676e6572051622ec0d6b4a5a6f83299424a5aba3c2418820c5ac00000000010400096ba182a23470b0fa54bc02797ed63a756bb4b900000000000000110000000000001c510000fbf88f19929d449b4a867a8c708aacd5b161330ad853d39b7f1d5ed307c5a23858a408c9048e326d747b020a094b3dc0d621a70e912845ed064b53511d1e156e0302000000000216096ba182a23470b0fa54bc02797ed63a756bb4b92163796265722d6d6f6e6461792d6d757369632d6e66742d636f6c6c656374696f6e0c6c6973742d696e2d757374780000000301000000000000000000000000000000040100000000000000000000000001f31e8906162bcf9762d5b90bc36dc1b4759b1727690f92ddd31367616d6d612d636f6d6d697373696f6e2d763100000000010400096ba182a23470b0fa54bc02797ed63a756bb4b900000000000000120000000000001c510001ab7c0b380e8fa40bd946fc31cecb848323672a07c3c1387d47fdfedda730fb4f7e925c7dcbd6e1d382a3d627d180570adced154b258fba9dcfb82281f75a60b40302000000000216096ba182a23470b0fa54bc02797ed63a756bb4b92163796265722d6d6f6e6461792d6d757369632d6e66742d636f6c6c656374696f6e0c6c6973742d696e2d757374780000000301000000000000000000000000000000040100000000000000000000000002c9070c06162bcf9762d5b90bc36dc1b4759b1727690f92ddd31367616d6d612d636f6d6d697373696f6e2d763100000000010400e8ab4a3e0ac57dff9fd4b51f269faace6dfc333c000000000000011d0000000000015a090001908f8ca88597c5272d474a97872463c3d4baa074baab6b30494fc5fe7147af8e2c43a21eddffebbfa566580c08d08a76b2e2717224341ed3ed73d8f80559c6be030200000002000216e8ab4a3e0ac57dff9fd4b51f269faace6dfc333c0500000000000f4240010316402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0f616d6d2d7661756c742d76322d3031161a1c2149309d35a24e8befa7d7b0feb1848e40ac1867616e676e616d2d726f73652d6170742d73747863697479044b41505403000001929f6e7e0c0216402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0e616d6d2d706f6f6c2d76322d30310b737761702d68656c706572000000050616402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0d746f6b656e2d777374782d763206165c0eaea9d116103937a60fda3e56a282969cfcf00b746f6b656e2d776b6170740100000000000000000000000005f5e1000100000000000000000000000005f5e1000a01000000000000000000009d4647293cff00000000010400e8ab4a3e0ac57dff9fd4b51f269faace6dfc333c000000000000011e0000000000015a1800014f8896be4dade963291d917ba5a93101d928faa5d79608b6137a6d99deaf9dcd50cb57ef652cd9a7323e60d477bf95512a17dc031e96632accda07bc6ea55c7b030200000002000216e8ab4a3e0ac57dff9fd4b51f269faace6dfc333c0500000000003567e0010316402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0f616d6d2d7661756c742d76322d3031161a1c2149309d35a24e8befa7d7b0feb1848e40ac1867616e676e616d2d726f73652d6170742d73747863697479044b415054030000057f6fc3ad2c0216402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0e616d6d2d706f6f6c2d76322d30310b737761702d68656c706572000000050616402da2c079e5d31d58b9cfc7286d1b1eb2f7834e0d746f6b656e2d777374782d763206165c0eaea9d116103937a60fda3e56a282969cfcf00b746f6b656e2d776b6170740100000000000000000000000005f5e1000100000000000000000000000014dc93800a010000000000000000000225c7a86fa53800000000010400d943168bf9a186a6302428fb5f8f46da00e1bb2700000000000001450000000000000bb8000045210cac6a017e92e39c79be7f9fefdc38553d9ae456e024de3805283659bf407259a32de62fd33d298aacc101900a4bd6044bd12e0b6fd964003167dea7d274030200000001020216d943168bf9a186a6302428fb5f8f46da00e1bb27160893b8f8e8c431ab4bc894b4c09cd45661f4b65e09626f6f6d2d6e66747304626f6f6d01000000000000000000000000000011b61002160893b8f8e8c431ab4bc894b4c09cd45661f4b65e09626f6f6d2d6e667473087472616e736665720000000301000000000000000000000000000011b60516d943168bf9a186a6302428fb5f8f46da00e1bb2705166ca4b90bd8c23a13ef66d73af019f0605fe5a90200000000010400d943168bf9a186a6302428fb5f8f46da00e1bb27000000000000014600000000000016060001392f5b4a53e8fddcaafb9bf06e870c2506ab9d6a1a0728247309f84a9e5399b5280c8dcf0e102ce0a64a7f801d0a780f90f8ef66118942711081a1abcba424d5030200000001020216d943168bf9a186a6302428fb5f8f46da00e1bb27160893b8f8e8c431ab4bc894b4c09cd45661f4b65e09626f6f6d2d6e66747304626f6f6d01000000000000000000000000000019911002160893b8f8e8c431ab4bc894b4c09cd45661f4b65e09626f6f6d2d6e667473087472616e736665720000000301000000000000000000000000000019910516d943168bf9a186a6302428fb5f8f46da00e1bb2705166ca4b90bd8c23a13ef66d73af019f0605fe5a902000000000104007d57a950f004f3a08a56020d706abd9d3278e4c90000000000004f93000000000001388000005d7eaea08aaca9b20750812d41b879e39a1f0db4a8e574de377cc55e95e24cbe6031ea50e10fbbb7dd31e70fea65c084e106ffd21f86e5421976c03ee96710d50301000000000216982f3ec112a5f5928a5c96a914bd733793b896a51c61726b6164696b6f2d7661756c74732d6d616e616765722d76312d310c72656465656d2d7661756c740000000a0616982f3ec112a5f5928a5c96a914bd733793b896a51b61726b6164696b6f2d7661756c74732d746f6b656e732d76312d310616982f3ec112a5f5928a5c96a914bd733793b896a51961726b6164696b6f2d7661756c74732d646174612d76312d310616982f3ec112a5f5928a5c96a914bd733793b896a51b61726b6164696b6f2d7661756c74732d736f727465642d76312d310616982f3ec112a5f5928a5c96a914bd733793b896a52061726b6164696b6f2d7661756c74732d706f6f6c2d6163746976652d76312d310616982f3ec112a5f5928a5c96a914bd733793b896a51c61726b6164696b6f2d7661756c74732d68656c706572732d76312d310616982f3ec112a5f5928a5c96a914bd733793b896a51461726b6164696b6f2d6f7261636c652d76322d3305167c68a484de88c734b1d109a003636a6c67f376c00616099fb88926d82f30b2f40eaf3ee423cb725bdb3b0b73747374782d746f6b656e0100000000000000000000000165a0bc000900000000010400fd28b84ff96df6d15cfbea47432cd1f8b1b920d80000000000000b7e0000000000000190000058fc012aafc5639faa52f8e25837fa54878ba2d567075a50c4705fabbf84c965454dd516a3ca1ae5e8096a783072587f9eb426d7fa45ce114853bc9b5967bafb030200000000000516b4a23e0b20f9b56514de4de67359a897fadc2acc000000012a05f20031303238393138333000000000000000000000000000000000000000000000000000`,
  );

  // const block_tx_merkle_root = bytesToHex(block.slice(69, 101))

  const block_version = block.slice(0, 1);
  const chain_length = block.slice(1, 9);
  const burn_spent = block.slice(9, 17);
  const consensus_hash = block.slice(17, 37);
  const parent_block_id = block.slice(37, 69);
  const tx_merkle_root = block.slice(69, 101);
  const state_root = block.slice(101, 133);
  const timestamp = block.slice(133, 141);
  const miner_signature = block.slice(141, 206);
  const signatureCount = Number("0x" + bytesToHex(block.slice(206, 210)));
  const pastSignatures = 210 + signatureCount * 65;
  // const signerBitVecLen = Number("0x" + bytesToHex(block.slice(pastSignatures, pastSignatures + 2)))
  const signerBitVecByteLen = Number(
    "0x" + bytesToHex(block.slice(pastSignatures + 2, pastSignatures + 6)),
  );
  const signer_bitvec = block.slice(
    pastSignatures,
    pastSignatures + 6 + signerBitVecByteLen,
  );
  const txids = bytesToHex(
    block.slice(pastSignatures + 10 + signerBitVecByteLen),
  )
    .split("000000000104")
    .map((item) => "000000000104" + item)
    .slice(1)
    .map((item) => hexToBytes(deserializeTransaction(item).txid()));

  const tx_merkle_tree = MerkleTree.new(txids);

  // const root = tx_merkle_tree.root();
  // console.log({txs})
  // const block_sighash = block_header_hash(
  //     block_version,
  //     chain_length,
  //     burn_spent,
  //     consensus_hash,
  //     parent_block_id,
  //     tx_merkle_root,
  //     state_root,
  //     timestamp,
  //     miner_signature,
  //     signer_bitvec
  // );

  const blockHeader = new Uint8Array([
    ...block_version,
    ...chain_length,
    ...burn_spent,
    ...consensus_hash,
    ...parent_block_id,
    ...tx_merkle_root,
    ...state_root,
    ...timestamp,
    ...miner_signature,
    ...signer_bitvec,
  ]);
  // const block_id = block_index_header_hash(block_sighash, consensus_hash);

  // console.log('calculated merkle root  ', bytesToHex(root));
  // console.log('expected merkle root    ', block_tx_merkle_root);

  // console.log('calculated block_sighash', bytesToHex(block_sighash));
  // console.log('expected block_sighash  ', block_info.hash.substring(2));

  // console.log('calculated block_id     ', bytesToHex(block_id));
  // console.log('expected block_id       ', block_info.index_block_hash.substring(2));

  // console.log("tree\n", tx_merkle_tree.pretty_print());
  // console.log('tx1 proof', tx_merkle_tree.proof(0).map(bytesToHex));
  // console.log('tx2 proof', tx_merkle_tree.proof(1).map(bytesToHex));
  // const proof = tx_merkle_tree.proof(0);

  // console.log(
  //   "proof CV",
  //   Cl.prettyPrint(proof_path_to_cv(0, proof, proof.length)),
  // );

  return {
    txids,
    tx_merkle_tree,
    blockHeader,
  };
}
