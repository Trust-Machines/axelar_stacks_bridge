import {
    createStacksPrivateKey,
    cvToJSON,
    hexToCV,
    listCV,
    signMessageHashRsv,
    tupleCV,
    uintCV,
} from "@stacks/transactions";
import { bufferFromAscii, bufferFromHex } from "@stacks/transactions/dist/cl";
import { ContractCallEvent, MessageApprovedEvent, MessageExecutedEvent, Signers, SignersRotatedEvent } from "./types";

// following code to generate
// pubkey => priv
export const SIGNER_KEYS: Record<string, string> = {
    '020544a6b1e14d0563e50bfbfdde11fdae17eac04d95bee50e595e6d80ea0a932b': '790e613eb3f5f5a8170bca7e9bb4081f4ac51b7c94d58ba640d7319eb3962c5f',
    '020efaddd546e33405db1fccd46610c30012f59137874d658c0315b910bf8793e5': '3b82629cdc2cad8581e5868475ff72995b823c036bd138731a1fe49972a8e3e8',
    '0215049277b2681c5a10f0dc93c67203ac3b865adfaf8d8d6d75df65082f3676e9': '83181da3110c9af4be2e6a53b410496e3a765b1663e769ba37aedfd31a338312',
    '0220ceccbc486f0bf0722150d02bbde9a4d688707148d911b85decac66b88fd374': '7be33b2f60570f72ff495def8358114096cc7684336c3da81c50b685a2d8c43f',
    '0227ca7e1f03ba942556c296d9bb47a0e4191c7f39f4e952dc198f81d02f1541bc': 'ddcb69651000009f4eba5362471e8cdfe500aa3b8b34422e78a44fbb0ac13146',
    '02341ee44fd64cc3d1a42e2b5323a3b04ab03db72521fb5b6bec37224fc370126e': '772d77c38d16139dde8efd382cd811011d2fda9cc802cf0cc36a31b00c077390',
    '02380cd654b47c153b9fbc51af0d4691e917e26428c48f00a549cea4c13fdd40ba': 'd3732b2b71d5739701601c4edca443131891d92f4deac7caf20929cab1705479',
    '02420d0b537df6fa02f59663c9928e734d907b6e93cece86e70e7f2d4837876b29': '46c01863cb2db9ed0103fef7d14437850e235afb1d3ae92cd238514a5a71b416',
    '0245558750fee6f8e7206c6846925826a319020c537f48ac6a03f5d550113cfd3e': '99c35c179591e26e2983153410869856e5926b41d8bc50d06152f468acb79681',
    '024c0b302ae9c4a6d1fd0d1c789880f68104ea866e6cff63f1563e4771c44cb1d0': '5a7aeff3d8ec75fbdebac611bf961707d99c6a53faf8b41e529b23a8612ed35c',
    '024e7ac024682317af8b5e8023849ed2eea017c3cb91ca283850f451e9a20dcba0': 'cbe80e4e901712170fc3684d85e41bba733dc851833c12f09cd18f34de725407',
    '024f59c18b21283c9515727e9a20d330d02fbb1258ed5942971f9233a3af488365': 'ee3d6cb21c0484a7c54839cc7b3f1308390d0e19c67fb6040ddf44dd1cf5c4e8',
    '0252e2248a7df966ad5ce768b12dd1edfe15dd43b22d4dfd71109dfdf0fef8f99b': 'cc9c0c329923cf37f272d0572f1ac490709c0eca99cd31df1a58cb27057c9fb9',
    '026b27c7ad0a3d839014ff751d41939bee79ea3ffa58c13ea4556c2b4597131550': 'ff3f4cefdfa93d59d7f3cec21019567737761a02da666db7b038c74abe86163e',
    '02703d593d53307cbdfce1a84a267cd89f89e1e935e4fabed8bf076d7500068012': '12512474ae6a5dd6a8d8f440d047c36d444b4fe2adc5503554e34fee62448d31',
    '029b17415c51cb64b3abcf52db6bd1d3117f5ba182e71cd447358f4b62f4293ef9': '5182dfe10ff844fbefadf1decb30a3cc5d2f86b50b9d66e799250118262fd209',
    '029fec8e8029dc192367a4ba3d7861c59b827bc85c0e72568a87001472881725a3': 'a69b4f2960b9bc32853f5bc181ce06d273bc4e61c02a4d240f280e55445f44d3',
    '02a847ffe0a6c204832f1d4d7d153690e9329aea7bda2065931ac04fae740dac9c': 'd65c61537693d95cd94e76b9710a33d53d318d26bee202f128ba5ac85bd0a6d1',
    '02b3ece00872566e3fd98324f804f47d240a03c0ce371ba7df61de043ee3766489': '6118b33a6ee0c86a3dda0e68ff709889b23788ffd5edc6b685cd7ae3e3a9ac94',
    '02b84b060947ee1f9bd7aa6e07969939243e090df60132eaab2f351fc6707d2439': 'a2d38a11c1e5028d66b2ea1cf1841d11cb8793acbc5a13d0f9cf5c38b1811585',
    '02bd54c2570ab215455eba6273c83f6250c33457bc0f43034a48fa5c7a07534efc': 'e5e025ddc5429e698f8deb2117b9f42cf520db3839721742c58fb3957638e0e2',
    '02c046d402898d733311d2c15c483af035178d9308feba94831b7b7783faeb01cb': '03260cd70821e29142c76f4e2ed1c706f3cf34ccd539ed8ee7c0667221bb70ca',
    '02ce1f0f2db6c157ebae4da676de8f9f037bb45746300270a37c67b687014e2393': '7bdd755dcf9367fb96161b8b94c7a45d59a6e446eeef38d125147e7102c25259',
    '02ce4170b1450178f12fa882fb261c99ebc80e78e3cd8e78f7aa0a602c13238525': 'a7246525a1a9eb99b11073efa2f41303151c2e7214513e9e5103903499902d2c',
    '02d2ecfcfc9d43d1279047bb1d10357d8ea7ac182ffeb19bbeb8a9de166ac65d8e': '3719771b8d4d46184e9ea132a4e1f422cc79025690a82b4a6b0281abb4163882',
    '02da486bb098cfb578549bf5e67015c2fbbaa566f9ba495fe97d1d3f6a317753c1': '600fba479eaf167f7e9b01a0b42f9e265245084db4685ce338e74dfe9def3b77',
    '02df3d75fc40a4c5c268e0a08dbb2651d66cebb7d1b091093b6b7affca43d38d06': '9f646bcdbd5e8a924e6560890dc333c65ee8329965d33d62ecaf59bc85da2883',
    '02f941c7d0f53efdab1547cc89329cfd1af4facc8792222be8671f5a6d7b0ed363': '7a1a347cbfac5ddb7072b78d7bf0c0f546b1de263513edd7e1d4d7eb2147f581',
    '02fb4e4166f24d4737e3fa201be816801e97274239992a2bcd194916c39a4c86e9': 'a9f7233de21ed9ca04a3dd612e04ead26f15dc3a0a55f597e39534eea9ea6f62',
    '031568fa0ffbcb0df8921ae156cb99c396d6aefd85f82d86c63fdaa71fd3fb2cb5': '80cb7096c700766eb5405783868b14af1de6d9f26b8128f3ee19a8f0c2b7ac30',
    '0327e54f827d8dbe5af3598ae3aa9fc37c4bc63d857e081ffd120f26f4deea1450': '36eeccdfddd5c13fc420d331a5cea736c11a8289b261745ab1b55ea2760f4454',
    '0331f0a7209953ddd55a985365c68afebfa2fe14073455f44827a273a71c57b8f7': 'fc0de1db41801b17f016e8bd198569198104b1b728a1b24b3d0f9307832f60fb',
    '03327b30dec9d4511ed683fb21c5e6f7767f09663b6d8bded8758319a81d20bff3': 'bbbf6316c8022800da5b07457bdf1a71b6bc64446ba784117d8fe3987a47a125',
    '033723415586affbdc7eb2466a1b148fb8621689471360a8745dba610e257ba16d': '5f8b8484bf9c56361958399c47fea26800ff85bd5a6fa14bcc4e7d88d282650b',
    '033d9b55c4d60c6e9037b59398f328752b53c398c1a0a68bd6f9f7ac695bc39fbb': '7dc6bb3a23474a65a2377a801f6bc1c97445e24e32171a1e1fb4a8eb5e23a7f3',
    '034dd39b7ab121bcebce548fa9a91e361c896852221c49d8dcc0a0529b0e953695': '6bd0dd645c374ce6f41c0501f1f4813d50a80d082468615361a8c18806be0c2a',
    '03651c34b686f8aceb33fd08f2d62601f8b5df8a0aa8a511e26bf7fdab5ea363f6': '0dc2c565746fb6f4ab0c8cc8d43fcd39ffd7297491d46b96064cadd1737333bb',
    '03704dc6342c5aa94addc66eb5804c22584662c69e22a7ef70df53fda733fae45a': 'd39c74fb030c6f781ccd27b2839526901806c105ee318ae4ca19d328af60e2dd',
    '03765254dc7229735adf2913f0117d402109ba665a74b9e7e8b90f9e963b35bdac': '647edaf01320c3f8036f3c435aedbc7bc897e1ff381ee2f3c4bfd78a8bd03ad4',
    '0391e3083946876ca3b96cdd75a76cc1b6017e7a61a4ee62f7b339655b41d9a7c9': 'dd9f2aac2957679d6f05a7b2d8433cf8468dd4d2c081bc468e7da81f2a9eede3',
    '03973cc1966439ae3e1397e98b596bd8da17b46f5eaac596b9b3deec196bce90ec': '1c56d32937ad7e6e0d5cb858f9af61373a54877a9dc15df3b80b113fd5d70f1c',
    '03a1ddad0a4bf6d060e6b05fa66bb61cb9fbe608f43f9d213209f6a8b2b1217ca5': '82c5b00e51cd8e4ae4ea20d67109e3c40c2f94ba0a4890cce3ec66b21f53c2c9',
    '03ae8c6cd54eb20f92a132d81d41da991258e450199b57589248abed2d2e64e99c': 'd512cf937f523d770a524f8ac4c6fa7e1d8f8a30f4305a6acd9bef2eb0f21c2c',
    '03b4fab6eca1bad19752fc0bd98368bd888d1a7816e57631c81b634e4fb2a67719': 'bad3816b3b1057ade09fed6a0e8f41b3dee6104ce810f63d24990b9fabca7cd5',
    '03b68cfb409d7cf1ac71739b843d9a5f81ed637ffc72e63839896d949fa8577dbc': 'a5e8f46e13819e92d83560110117c5378b62b9564e3d23eb36c8aae92bac70c3',
    '03ba3c1ead575eb48a79b02d8d1eae12d520e804230e081999c2997960f1e2d79a': '5be34d4f481b97bb7564fc31f2910b311fb11576d84130b2fca4c4530a31c5bd',
    '03c16c4046bb843736fe43856f7601e168fca0444c0d88dc09e5b9393ebd528b9c': '4c38b6f7ab4bde10a0939fa66d355e218225567402691e8b6acb783928f05f50',
    '03c1b0ddbf99857ca9da5cbdf26e0eea8d2b02c2873cea8fc493fa6bc3383bc447': '8bd8a44a5fabbaa633d47de96c775f3c0681a3080cabaf6de819e37106d3d57c',
    '03ee6deb63469adde30a310f241ce07c8be6bc2f4e33651f58c3b11aadb9117e75': 'c79359c02cf0c96fb023ee2bf2b541e4d580a31c4083c601968cb9ec2ca5115a',
    '03f69590f15ffff3475237a2bef8c49088aaffb0877b3a2b453ecf89bcdb1a70a2': '180e35a5bfb78db55444344aebb81bfa520ecc7ac6939114b2954c06f8315b55'
  }

/*

import { makeRandomPrivKey, privateKeyToString, publicKeyFromSignatureRsv } from "@stacks/transactions";
const pubs_: Record<string, string> = {};
const pubs: Record<string, string> = {};

for (let x = 0; x < 50; x++) {
    const priv = makeRandomPrivKey();
    const strPriv = privateKeyToString(priv)

    const messageHash = "0ebdc3317b75839f643387d783535adc360ca01f33c75f7c1e7373adcd675c0b";

    const signature = signMessageHashRsv({
        messageHash: messageHash,
        privateKey: priv
    })

    const pubKey = publicKeyFromSignatureRsv(messageHash, signature)

    pubs_[pubKey] = strPriv;
}

const keys = Object.keys(pubs_).sort();

for(let k of keys){
    pubs[k] = pubs_[k];
}

console.log(pubs)
*/

export const signMessageHashForAddress = (messageHash: string, address: string) => {
    return signMessageHashRsv({
        messageHash: messageHash,
        privateKey: createStacksPrivateKey(
            SIGNER_KEYS[address]
        ),
    }).data;
}

export const signersToCv = (data: Signers) => {
    return tupleCV({
        "signers": listCV([
            ...data.signers.map(x => tupleCV({
                "signer": bufferFromHex(x.signer),
                "weight": uintCV(x.weight)
            }))

        ]),
        "threshold": uintCV(data.threshold),
        "nonce": bufferFromAscii(data.nonce)
    })
}

export const makeProofCV = (data: Signers, messageHashToSign: string) => {
    return tupleCV({
        "signers": signersToCv(data),
        "signatures": listCV([
            ...data.signers.map((x) => bufferFromHex(signMessageHashForAddress(messageHashToSign.replace('0x', ''), x.signer)))
        ])
    });
}

export const getSigners = (start: number, end: number, weight: number, threshold: number, nonce: string): Signers => {
    return {
        signers: Object.keys(SIGNER_KEYS).slice(start, end).map(s => ({
            signer: s,
            weight
        })),
        threshold,
        nonce
    }
}

export const contractCallEventToObj = (rawHex: string): ContractCallEvent => {
    const json = cvToJSON(hexToCV(rawHex));

    return {
        type: json.value['type'].value,
        sender: json.value.sender.value,
        destinationChain: json.value['destination-chain'].value,
        destinationContractAddress: json.value['destination-contract-address'].value,
        payload: Buffer.from(bufferFromHex(json.value.payload.value).buffer).toString('ascii'),
        payloadHash: json.value['payload-hash'].value
    }
}

export const messageApprovedEventToObj = (rawHex: string): MessageApprovedEvent => {
    const json = cvToJSON(hexToCV(rawHex));

    return {
        type: json.value['type'].value,
        commandId: json.value['command-id'].value,
        sourceChain: json.value['source-chain'].value,
        messageId: json.value['message-id'].value,
        sourceAddress: json.value['source-address'].value,
        contractAddress: json.value['contract-address'].value,
        payloadHash: json.value['payload-hash'].value
    }
}

export const messageExecutedEventToObj = (rawHex: string): MessageExecutedEvent => {
    const json = cvToJSON(hexToCV(rawHex));

    return {
        type: json.value['type'].value,
        commandId: json.value['command-id'].value,
        sourceChain: json.value['source-chain'].value,
        messageId: json.value['message-id'].value,
    }
}

export const signersRotatedEventToObj = (rawHex: string): SignersRotatedEvent => {
    const json = cvToJSON(hexToCV(rawHex));

    const signers: Signers = {
        signers: json.value['signers'].value.signers.value.map((s: any) => ({ signer: s.value.signer.value.replace('0x', ''), weight: Number(s.value.weight.value) })),
        threshold: Number(json.value['signers'].value.threshold.value),
        nonce: Buffer.from(bufferFromHex(json.value['signers'].value.nonce.value).buffer).toString('ascii')
    }

    return {
        type: json.value['type'].value,
        epoch: Number(json.value['epoch'].value),
        signersHash: Buffer.from(json.value['signers-hash'].value).toString('ascii'),
        signers: signers
    }
}
